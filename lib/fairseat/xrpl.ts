import { createHash } from "node:crypto";
import { NBA_CODES, slug } from "./data";
import {
  Client,
  Wallet,
  convertHexToString,
  convertStringToHex,
  encodeAccountID,
  getNFTokenID,
  hashes,
  isValidClassicAddress,
  type SubmittableTransaction,
  type Transaction,
  type TransactionMetadata,
} from "xrpl";

// Everything Fairseat does on the XRP Ledger testnet.
//
// - The issuer issues the test dollars fans pay with.
// - The organizer mints the tickets, and is who the fans' money ends up with.
// - Where an event's teams sell their own tickets, each team has an organizer account of its own.
//   It mints that team's tickets when it releases them, and is who the money for them ends up with.
// - A ticket is an NFT whose URI names the event, the seat and the team.
// - Buying is one Batch: the fan's dollars go into an escrow and the ticket moves to the fan, or
//   neither happens. The escrow is released to the organizer once the finalists are decided.
// - A resale is one NFTokenAcceptOffer between two fans, with the organizer's cut taken by the ledger.

const WS = process.env.XRPL_WS ?? "wss://testnet.xrpl-labs.com";
const FAUCET = "faucet.altnet.rippletest.net";
const EXPLORER = "https://testnet.xrpl.org";

export const CURRENCY = "USD";
/** What a new test wallet starts with. */
export const STARTING_DOLLARS = 5000;
/** The organizer's cut of every resale, in thousandths of a percent: 5000 is 5%. */
const RESALE_CUT = 5000;
export const RESALE_RATE = RESALE_CUT / 100_000;
const TRANSFERABLE = 8;
const BURNABLE = 1;
const SELL_OFFER = 1;
/** Marks a transaction as one part of a Batch. */
const INNER = 0x40000000;
/** A Batch whose parts all happen or none do. */
const ALL_OR_NOTHING = 0x00010000;
/** A Batch holds at most this many transactions. */
const BATCH_LIMIT = 8;
/** Seconds between 1970 and 2000, where the ledger's clock starts. */
const RIPPLE_EPOCH = 946684800;

// Proof links open pages inside the app, which read the ledger through our own connection.
export const txUrl = (hash: string) => `/proof/${hash}`;
export const accountUrl = (address: string) => `/proof/account/${address}`;
/** A ticket's proof is the gate check: it asks the ledger who holds it and whether it gets in. */
export const ticketUrl = (nftId: string) => `/gate?code=${nftId}`;
// The public explorer, kept as a second opinion.
export const explorerTxUrl = (hash: string) =>
  `${EXPLORER}/transactions/${hash}`;
export const explorerAccountUrl = (address: string) =>
  `${EXPLORER}/accounts/${address}`;

// One connection is kept open and shared. Opening a new one for every read gets the app turned
// away by the public testnet server after a few page loads.
const shared = globalThis as { fairseatLedger?: Promise<Client> };

function connect() {
  const opening = (async () => {
    const client = new Client(WS, { connectionTimeout: 20000 });
    await client.connect();
    return client;
  })();
  shared.fairseatLedger = opening;
  // A failed attempt must not be handed to the next caller.
  opening.catch(() => {
    if (shared.fairseatLedger === opening) shared.fairseatLedger = undefined;
  });
  return opening;
}

async function withClient<T>(run: (client: Client) => Promise<T>) {
  let client = await (shared.fairseatLedger ?? connect());
  if (!client.isConnected()) client = await connect();
  return run(client);
}

function issuer() {
  const seed = process.env.XRPL_ISSUER_SEED;
  if (!seed)
    throw new Error(
      "XRPL_ISSUER_SEED is not set. Run node scripts/setup-xrpl.mjs",
    );
  return Wallet.fromSeed(seed);
}

function organizer() {
  const seed = process.env.XRPL_ORGANIZER_SEED;
  if (!seed)
    throw new Error(
      "XRPL_ORGANIZER_SEED is not set. Run node --env-file-if-exists=.env.local scripts/setup-xrpl.mjs",
    );
  return Wallet.fromSeed(seed);
}

export const organizerAddress = () => organizer().address;

// One organizer account per team, for events whose teams sell their own tickets. Each is its own
// account on the ledger with its own keys. The keys are worked out from the organizer seed and the
// team, so there are no further seeds to store.
const teamOrganizers = new Map<string, Wallet>();

function teamOrganizer(team: string) {
  let wallet = teamOrganizers.get(team);
  if (!wallet) {
    const entropy = createHash("sha512")
      .update(`${organizer().seed}|team|${team}`)
      .digest()
      .subarray(0, 16);
    wallet = Wallet.fromEntropy(entropy);
    teamOrganizers.set(team, wallet);
  }
  return wallet;
}

export const teamOrganizerAddress = (team: string) =>
  teamOrganizer(team).address;

/** The wallet of every club that sells its own tickets. */
const clubAddresses = () =>
  new Set(
    Object.keys(NBA_CODES).map((name) => teamOrganizerAddress(slug(name))),
  );

/**
 * The lock on a ticket's escrow and the key that opens it. Only Fairseat can work out the key, so
 * the money moves when Fairseat says the finalists are decided and not before.
 */
function escrowLock(nftId: string) {
  const key = createHash("sha256")
    .update(`${organizer().seed}|${nftId}`)
    .digest();
  const lock = createHash("sha256").update(key).digest("hex");
  return {
    condition: `A0258020${lock}810120`.toUpperCase(),
    fulfillment: `A0228020${key.toString("hex")}`.toUpperCase(),
  };
}

/** One part of a Batch: it carries no fee or signature of its own. */
const inner = (tx: Record<string, unknown>) => ({
  RawTransaction: {
    ...tx,
    Flags: (Number(tx.Flags) || 0) | INNER,
    Fee: "0",
    SigningPubKey: "",
  },
});

/** Submits several transactions from one account so that all of them happen or none do. */
async function submitTogether(
  client: Client,
  wallet: Wallet,
  parts: Record<string, unknown>[],
  what: string,
) {
  // A Batch needs at least two parts. One on its own is just a transaction.
  const tx =
    parts.length === 1
      ? parts[0]
      : {
          TransactionType: "Batch",
          Account: wallet.address,
          Flags: ALL_OR_NOTHING,
          RawTransactions: parts.map(inner),
        };
  const done = await client.submitAndWait(tx as SubmittableTransaction, {
    wallet,
  });
  assertOk(done.result.meta, what);
  // The ledger accepts a Batch even when it refuses one of its parts, and then none of them happen.
  // The parts are on the ledger only if all of them went through, so the first one is looked up.
  const first = (
    done.result.tx_json as {
      RawTransactions?: { RawTransaction: Transaction }[];
    }
  ).RawTransactions?.[0];
  if (first) {
    const applied = await client
      .request({
        command: "tx",
        transaction: hashes.hashSignedTx(first.RawTransaction),
      })
      .then(
        () => true,
        (error) => {
          if (error?.data?.error === "txnNotFound") return false;
          throw error;
        },
      );
    if (!applied)
      throw new Error(
        `${what} failed on the ledger: one step was refused, so nothing happened`,
      );
  }
  return done.result;
}

const dollars = (value: number) => ({
  currency: CURRENCY,
  issuer: issuer().address,
  value: value.toFixed(2),
});

function assertOk(
  meta: string | TransactionMetadata | undefined,
  what: string,
) {
  const result = typeof meta === "object" ? meta.TransactionResult : undefined;
  if (result !== "tesSUCCESS")
    throw new Error(`${what} failed on the ledger: ${result ?? "no result"}`);
}

export type FanWallet = { seed: string; address: string };

/** A funded testnet account that trusts the issuer's dollars and holds a starting balance of them. */
export function createFanWallet(): Promise<FanWallet> {
  return withClient(async (client) => {
    const { wallet } = await client.fundWallet(null, { faucetHost: FAUCET });
    const trust = await client.submitAndWait(
      {
        TransactionType: "TrustSet",
        Account: wallet.address,
        LimitAmount: dollars(1_000_000),
      },
      { wallet },
    );
    assertOk(trust.result.meta, "Trusting test dollars");
    const gift = await client.submitAndWait(
      {
        TransactionType: "Payment",
        Account: issuer().address,
        Destination: wallet.address,
        Amount: dollars(STARTING_DOLLARS),
      },
      { wallet: issuer() },
    );
    assertOk(gift.result.meta, "Sending test dollars");
    return { seed: wallet.seed!, address: wallet.address };
  });
}

export type TeamOrganizer = {
  address: string;
  /** The account exists on the ledger and can be paid in test dollars. */
  ready: boolean;
  balance: number;
};

const notFound = (error: unknown) =>
  (error as { data?: { error?: string } }).data?.error === "actNotFound";

/** Where a team's organizer account stands on the ledger. */
export function getTeamOrganizer(team: string): Promise<TeamOrganizer> {
  return withClient(async (client) => {
    const { address } = teamOrganizer(team);
    try {
      const lines = await client.request({
        command: "account_lines",
        account: address,
        peer: issuer().address,
      });
      const line = lines.result.lines.find(
        (item) => item.currency === CURRENCY,
      );
      return {
        address,
        ready: line !== undefined,
        balance: line ? Number(line.balance) : 0,
      };
    } catch (error) {
      if (notFound(error)) return { address, ready: false, balance: 0 };
      throw error;
    }
  });
}

/**
 * Makes a team's organizer account ready to sell: funded from the testnet faucet and trusting the
 * issuer's dollars. Each step is skipped if it is already done.
 */
export async function setUpTeamOrganizer(team: string) {
  if ((await getTeamOrganizer(team)).ready) return;
  return withClient(async (client) => {
    const wallet = teamOrganizer(team);
    const exists = await client
      .request({ command: "account_info", account: wallet.address })
      .then(
        () => true,
        (error) => {
          if (notFound(error)) return false;
          throw error;
        },
      );
    if (!exists) await client.fundWallet(wallet, { faucetHost: FAUCET });
    const trust = await client.submitAndWait(
      {
        TransactionType: "TrustSet",
        Account: wallet.address,
        LimitAmount: dollars(100_000_000),
      },
      { wallet },
    );
    assertOk(trust.result.meta, "Trusting test dollars");
  });
}

export function getBalance(address: string): Promise<number> {
  return withClient(async (client) => {
    const lines = await client.request({
      command: "account_lines",
      account: address,
      peer: issuer().address,
    });
    const line = lines.result.lines.find((item) => item.currency === CURRENCY);
    return line ? Number(line.balance) : 0;
  });
}

export type TicketRecord = {
  eventId: string;
  seatId: string;
  team: string;
  paid: number;
};
export type HeldTicket = TicketRecord & { nftId: string };

const PREFIX = "fairseat|1";

const encode = (record: TicketRecord) =>
  convertStringToHex(
    [
      PREFIX,
      record.eventId,
      record.seatId,
      record.team,
      record.paid.toFixed(2),
    ].join("|"),
  );

function decode(uri: string | undefined): TicketRecord | null {
  if (!uri) return null;
  const text = convertHexToString(uri);
  if (!text.startsWith(`${PREFIX}|`)) return null;
  const [, , eventId, seatId, team, paid] = text.split("|");
  return eventId && seatId && team
    ? { eventId, seatId, team, paid: Number(paid) || 0 }
    : null;
}

/** The Fairseat tickets an account holds, read straight from the ledger. */
export function listTickets(address: string): Promise<HeldTicket[]> {
  return withClient(async (client) => {
    const held: HeldTicket[] = [];
    let marker: unknown;
    do {
      const page = await client.request({
        command: "account_nfts",
        account: address,
        limit: 400,
        marker,
      });
      for (const nft of page.result.account_nfts) {
        const record = decode(nft.URI);
        // Tickets sold before the organizer account existed were minted by the issuer. A ticket
        // a team released was minted by that team's own organizer.
        const ours =
          record !== null &&
          (nft.Issuer === organizer().address ||
            nft.Issuer === issuer().address ||
            nft.Issuer === teamOrganizerAddress(record.team));
        if (ours) held.push({ ...record, nftId: nft.NFTokenID });
      }
      marker = page.result.marker;
    } while (marker);
    return held;
  });
}

export type Purchase = {
  nftId: string;
  hash: string;
  /** The transaction that minted the ticket. */
  mintHash: string;
  /** Where the fan's payment is held: an escrow is named by its owner and a sequence number. */
  escrow: { owner: string; sequence: number };
};

/** One Batch from the fan: the price is locked in an escrow for the seller, and the offered ticket is taken. */
async function payAndTake(
  client: Client,
  fan: Wallet,
  seller: string,
  nftId: string,
  offerId: string,
  paid: number,
  refundAfter: Date,
) {
  const done = await submitTogether(
    client,
    fan,
    [
      {
        TransactionType: "EscrowCreate",
        Account: fan.address,
        Destination: seller,
        Amount: dollars(paid),
        Condition: escrowLock(nftId).condition,
        CancelAfter: Math.floor(refundAfter.getTime() / 1000) - RIPPLE_EPOCH,
      },
      {
        TransactionType: "NFTokenAcceptOffer",
        Account: fan.address,
        NFTokenSellOffer: offerId,
      },
    ],
    "Paying for the ticket",
  );
  // The escrow is the first part of the Batch, so it takes the number after the Batch's own.
  const sequence = (done.tx_json.Sequence ?? 0) + 1;
  return { hash: done.hash, escrow: { owner: fan.address, sequence } };
}

/**
 * Sells a new ticket. The organizer mints it with an offer only this fan can take. Then, in one
 * Batch, the fan locks the price in an escrow for the organizer and takes the ticket.
 * The escrow can be undone by the fan after `refundAfter` if it was never released.
 */
export function buyTicket(
  fanSeed: string,
  record: TicketRecord,
  refundAfter: Date,
): Promise<Purchase> {
  return buyTickets(fanSeed, [record], refundAfter).then(([bought]) => bought);
}

/** The most tickets one Batch can pay for: each takes an escrow and an accepted offer. */
export const GROUP_LIMIT = BATCH_LIMIT / 2;

/** The escrows an account has locked, each with the lock on it and the entry's id on the ledger. */
async function lockedEscrows(client: Client, owner: string) {
  const found: { index: string; Condition?: string; PreviousTxnID?: string }[] =
    [];
  let marker: unknown;
  do {
    const page = await client.request({
      command: "account_objects",
      account: owner,
      type: "escrow",
      ledger_index: "validated",
      limit: 400,
      marker,
    });
    for (const entry of page.result.account_objects as unknown as (Fields & {
      index: string;
    })[])
      if (entry.Account === owner)
        found.push({
          index: entry.index,
          Condition: text(entry.Condition) ?? undefined,
          PreviousTxnID: text(entry.PreviousTxnID) ?? undefined,
        });
    marker = page.result.marker;
  } while (marker);
  return found;
}

/**
 * Sells up to four new tickets to one fan, paid for together. The organizer mints each with an
 * offer only this fan can take. Then, in one Batch, the fan locks each price in its own escrow and
 * takes each ticket: all of it happens or none of it does. The purchases come back in the order asked.
 */
export function buyTickets(
  fanSeed: string,
  records: TicketRecord[],
  refundAfter: Date,
): Promise<Purchase[]> {
  return withClient(async (client) => {
    if (records.length < 1 || records.length > GROUP_LIMIT)
      throw new Error(`One payment covers 1 to ${GROUP_LIMIT} tickets`);
    const fan = Wallet.fromSeed(fanSeed);
    const house = organizer();
    const minted: { nftId: string; offerId: string; mintHash: string }[] = [];

    try {
      for (const record of records) {
        const mint = await client.submitAndWait(
          {
            TransactionType: "NFTokenMint",
            Account: house.address,
            NFTokenTaxon: 0,
            Flags: TRANSFERABLE | BURNABLE,
            TransferFee: RESALE_CUT,
            URI: encode(record),
            Amount: "0",
            Destination: fan.address,
          },
          { wallet: house },
        );
        assertOk(mint.result.meta, "Minting the ticket");
        const meta = mint.result.meta as TransactionMetadata & {
          offer_id?: string;
        };
        const nftId = getNFTokenID(meta);
        if (!nftId || !meta.offer_id)
          throw new Error("The ledger did not return a ticket id");
        minted.push({
          nftId,
          offerId: meta.offer_id,
          mintHash: mint.result.hash,
        });
      }

      const what =
        records.length === 1
          ? "Paying for the ticket"
          : "Paying for the tickets";
      const paid = await submitTogether(
        client,
        fan,
        minted.flatMap((ticket, at) => [
          {
            TransactionType: "EscrowCreate",
            Account: fan.address,
            Destination: house.address,
            Amount: dollars(records[at].paid),
            Condition: escrowLock(ticket.nftId).condition,
            CancelAfter:
              Math.floor(refundAfter.getTime() / 1000) - RIPPLE_EPOCH,
          },
          {
            TransactionType: "NFTokenAcceptOffer",
            Account: fan.address,
            NFTokenSellOffer: ticket.offerId,
          },
        ]),
        what,
      );

      // A Batch is recorded as a success even when its parts were turned away, so the escrows are
      // read back from the ledger. One missing means nothing in the Batch happened.
      const first = (paid.tx_json.Sequence ?? 0) + 1;
      const locked = await lockedEscrows(client, fan.address);
      const purchases: Purchase[] = [];
      for (const [at, ticket] of minted.entries()) {
        const { condition } = escrowLock(ticket.nftId);
        const entry = locked.find((item) => item.Condition === condition);
        if (!entry) throw new Error(`${what} failed on the ledger`);
        // Each part of the Batch takes the next number after the Batch's own, so this ticket's
        // escrow should hold the one two further on than the last. The entry's id says if it does.
        let sequence = first + 2 * at;
        if (hashes.hashEscrow(fan.address, sequence) !== entry.index) {
          const made = entry.PreviousTxnID
            ? await client
                .request({ command: "tx", transaction: entry.PreviousTxnID })
                .catch(() => null)
            : null;
          const real = (made?.result.tx_json as Fields | undefined)?.Sequence;
          if (
            typeof real !== "number" ||
            hashes.hashEscrow(fan.address, real) !== entry.index
          )
            throw new Error("The ledger did not say where the payment is held");
          sequence = real;
        }
        purchases.push({
          nftId: ticket.nftId,
          hash: paid.hash,
          mintHash: ticket.mintHash,
          escrow: { owner: fan.address, sequence },
        });
      }
      return purchases;
    } catch (error) {
      // The fan did not pay, so no ticket must be left waiting for them. A ticket the fan did take
      // is theirs and is left alone: the organizer names no owner here, so that burn is refused.
      for (const ticket of minted)
        await client
          .submitAndWait(
            {
              TransactionType: "NFTokenBurn",
              Account: house.address,
              NFTokenID: ticket.nftId,
            },
            { wallet: house },
          )
          .catch(() => undefined);
      throw error;
    }
  });
}

export type Release = { record: TicketRecord; nftId: string; hash: string };

/** The id and record of every item an account holds. */
async function heldItems(client: Client, address: string) {
  const held: { nftId: string; uri: string | undefined }[] = [];
  let marker: unknown;
  do {
    const page = await client.request({
      command: "account_nfts",
      account: address,
      limit: 400,
      marker,
    });
    for (const nft of page.result.account_nfts)
      held.push({ nftId: nft.NFTokenID, uri: nft.URI });
    marker = page.result.marker;
  } while (marker);
  return held;
}

/** Whether an escrow is on the ledger now. One that was released or taken back is not. */
async function escrowExists(
  client: Client,
  escrow: { owner: string; sequence: number },
) {
  try {
    await client.request({
      command: "ledger_entry",
      escrow: { owner: escrow.owner, seq: escrow.sequence },
      ledger_index: "validated",
    });
    return true;
  } catch (error) {
    const code = (error as { data?: { error?: string } }).data?.error;
    if (code === "entryNotFound") return false;
    throw error;
  }
}

/** The ids of every NFT an account holds now. An account that is not on the ledger holds none. */
async function nftsIn(client: Client, holder: string) {
  const held = new Set<string>();
  let marker: unknown;
  try {
    do {
      const page = await client.request({
        command: "account_nfts",
        account: holder,
        ledger_index: "validated",
        limit: 400,
        marker,
      });
      for (const nft of page.result.account_nfts) held.add(nft.NFTokenID);
      marker = page.result.marker;
    } while (marker);
  } catch (error) {
    const code = (error as { data?: { error?: string } }).data?.error;
    if (code !== "actNotFound") throw error;
  }
  return held;
}

/**
 * Releases a team's tickets: its organizer mints each one into its own account, where it waits for
 * a buyer. Up to eight are minted in one Batch. The price is not known yet, so the record carries 0.
 */
export function releaseTickets(
  team: string,
  records: TicketRecord[],
): Promise<Release[]> {
  return withClient(async (client) => {
    const house = teamOrganizer(team);
    const before = new Set(
      (await heldItems(client, house.address)).map((item) => item.nftId),
    );
    const hashes = new Map<string, string>();
    for (let at = 0; at < records.length; at += BATCH_LIMIT) {
      const chunk = records.slice(at, at + BATCH_LIMIT);
      const done = await submitTogether(
        client,
        house,
        chunk.map((record) => ({
          TransactionType: "NFTokenMint",
          Account: house.address,
          NFTokenTaxon: 0,
          Flags: TRANSFERABLE | BURNABLE,
          TransferFee: RESALE_CUT,
          URI: encode(record),
        })),
        "Releasing the tickets",
      );
      for (const record of chunk) hashes.set(encode(record), done.hash);
    }

    // A Batch does not say which tickets it made, so the new ones are read back from the account.
    const released = (await heldItems(client, house.address)).flatMap(
      (item): Release[] => {
        const record = records.find((entry) => encode(entry) === item.uri);
        const hash = item.uri && hashes.get(item.uri);
        return record && hash && !before.has(item.nftId)
          ? [{ record, nftId: item.nftId, hash }]
          : [];
      },
    );
    if (released.length !== records.length)
      throw new Error("The ledger did not return every released ticket");
    return released;
  });
}

/**
 * Gives a fan back a payment that was never released. The ledger allows it only to be undone once
 * the escrow's deadline has passed, and only while the escrow still exists.
 */
export function refundEscrow(
  fanSeed: string,
  escrow: { owner: string; sequence: number },
) {
  return withClient(async (client) => {
    const fan = Wallet.fromSeed(fanSeed);
    const cancel = await client.submitAndWait(
      {
        TransactionType: "EscrowCancel",
        Account: fan.address,
        Owner: escrow.owner,
        OfferSequence: escrow.sequence,
      },
      { wallet: fan },
    );
    assertOk(cancel.result.meta, "Taking the money back");
    // The result is not taken on trust: the escrow must be gone from the ledger.
    if (await escrowExists(client, escrow))
      throw new Error("The ledger still holds the payment");
    return { hash: cancel.result.hash };
  });
}

/**
 * Sells a ticket its team has released. The team's organizer offers it to this fan alone. Then, in
 * one Batch, the fan locks the price in an escrow for that organizer and takes the ticket.
 */
export function buyReleasedTicket(
  fanSeed: string,
  team: string,
  nftId: string,
  paid: number,
  refundAfter: Date,
): Promise<Omit<Purchase, "mintHash">> {
  return withClient(async (client) => {
    const fan = Wallet.fromSeed(fanSeed);
    const house = teamOrganizer(team);

    const offer = await client.submitAndWait(
      {
        TransactionType: "NFTokenCreateOffer",
        Account: house.address,
        NFTokenID: nftId,
        Amount: "0",
        Destination: fan.address,
        Flags: SELL_OFFER,
      },
      { wallet: house },
    );
    assertOk(offer.result.meta, "Offering the ticket");
    const offerId = (
      offer.result.meta as TransactionMetadata & { offer_id?: string }
    ).offer_id;
    if (!offerId) throw new Error("The ledger did not return an offer id");

    try {
      const done = await payAndTake(
        client,
        fan,
        house.address,
        nftId,
        offerId,
        paid,
        refundAfter,
      );
      return { nftId, ...done };
    } catch (error) {
      // The fan did not pay, so the ticket goes back to waiting for any buyer.
      await client
        .submitAndWait(
          {
            TransactionType: "NFTokenCancelOffer",
            Account: house.address,
            NFTokenOffers: [offerId],
          },
          { wallet: house },
        )
        .catch(() => undefined);
      throw error;
    }
  });
}

/**
 * Removes a ticket from whoever holds it. The organizer can do this because every ticket is minted
 * burnable. The holder's wallet is read back to confirm it is gone. A ticket a club released is
 * burned by that club's own wallet, so name the club.
 */
export function burnTicket(nftId: string, holder: string, team?: string) {
  return withClient(async (client) => {
    const house = team ? teamOrganizer(team) : organizer();
    const burn = await client.submitAndWait(
      {
        TransactionType: "NFTokenBurn",
        Account: house.address,
        Owner: holder,
        NFTokenID: nftId,
      },
      { wallet: house },
    );
    assertOk(burn.result.meta, "Removing the ticket");
    if ((await nftsIn(client, holder)).has(nftId))
      throw new Error("The ledger still holds the ticket");
    return { hash: burn.result.hash };
  });
}

export type Settlement = {
  nftId: string;
  /** The escrow holding what was paid for this ticket, if it has not been released yet. */
  escrow: { owner: string; sequence: number } | null;
  /** Who holds the ticket now, if it is to be burned because its team missed the final. */
  burnFrom: string | null;
};

/**
 * What the ledger shows a settlement did to one thing. "done": it was there before and is gone
 * after. "gone": it was not there to act on. "failed": it is still there.
 */
export type SettleOutcome = "done" | "gone" | "failed";

/** What settling did for one ticket, read back from the ledger. Null where nothing was asked. */
export type Settled = {
  nftId: string;
  release: SettleOutcome | null;
  burn: SettleOutcome | null;
  /** The transaction that released the payment, and the one that burned the ticket. */
  releaseHash?: string;
  burnHash?: string;
  /** The ledger's reason, when a part was turned away. */
  why?: string;
};

/**
 * Settles tickets once the finalists are decided: releases each payment to the organizer and burns
 * the tickets for teams that missed out. A Batch is recorded as a success even when its parts were
 * turned away, so every escrow and ticket is read from the ledger before and after. Returns what
 * really happened to each ticket and the transactions that did it. Tickets a club released are
 * settled by that club's own wallet, so name the club.
 */
export function settleTickets(
  tickets: Settlement[],
  team?: string,
): Promise<{ hashes: string[]; tickets: Settled[] }> {
  return withClient(async (client) => {
    const house = team ? teamOrganizer(team) : organizer();
    type Part = {
      kind: "release" | "burn";
      about: Settled;
      from: Settlement;
      tx: Record<string, unknown>;
    };

    /** The parts whose escrow or ticket is on the ledger right now. */
    const present = async (parts: Part[]) => {
      const wallets = new Map<string, Set<string>>();
      const there: Part[] = [];
      for (const part of parts) {
        const { escrow, burnFrom, nftId } = part.from;
        if (part.kind === "release") {
          if (escrow && (await escrowExists(client, escrow))) there.push(part);
          continue;
        }
        if (!burnFrom) continue;
        if (!wallets.has(burnFrom))
          wallets.set(burnFrom, await nftsIn(client, burnFrom));
        if (wallets.get(burnFrom)?.has(nftId)) there.push(part);
      }
      return there;
    };

    const settled: Settled[] = [];
    const asked: Part[] = [];
    for (const ticket of tickets) {
      const about: Settled = { nftId: ticket.nftId, release: null, burn: null };
      settled.push(about);
      if (ticket.escrow)
        asked.push({
          kind: "release",
          about,
          from: ticket,
          tx: {
            TransactionType: "EscrowFinish",
            Account: house.address,
            Owner: ticket.escrow.owner,
            OfferSequence: ticket.escrow.sequence,
            Condition: escrowLock(ticket.nftId).condition,
            Fulfillment: escrowLock(ticket.nftId).fulfillment,
          },
        });
      if (ticket.burnFrom)
        asked.push({
          kind: "burn",
          about,
          from: ticket,
          tx: {
            TransactionType: "NFTokenBurn",
            Account: house.address,
            // A ticket nobody bought is still in the club's own account.
            ...(ticket.burnFrom !== house.address && {
              Owner: ticket.burnFrom,
            }),
            NFTokenID: ticket.nftId,
          },
        });
    }

    // Only what is on the ledger is sent. One part with nothing to act on would undo the Batch.
    const parts = await present(asked);
    for (const part of asked)
      if (!parts.includes(part)) part.about[part.kind] = "gone";

    const mark = (part: Part, outcome: SettleOutcome, hash?: string) => {
      part.about[part.kind] = outcome;
      if (hash) part.about[`${part.kind}Hash`] = hash;
    };
    const submit = (list: Part[]) =>
      submitTogether(
        client,
        house,
        list.map((part) => part.tx),
        "Settling the tickets",
      ).then(
        (done) => ({ hash: done.hash as string | null, why: undefined }),
        (error: unknown) => ({
          hash: null,
          why: error instanceof Error ? error.message : String(error),
        }),
      );

    const hashes: string[] = [];
    for (let at = 0; at < parts.length; at += BATCH_LIMIT) {
      const chunk = parts.slice(at, at + BATCH_LIMIT);
      const together = await submit(chunk);
      const left = await present(chunk);
      if (together.hash && left.length < chunk.length)
        hashes.push(together.hash);
      for (const part of chunk)
        if (!left.includes(part))
          mark(part, "done", together.hash ?? undefined);
      // Whatever the Batch left behind is sent again one at a time. A transaction on its own
      // reports its own result, and one bad part no longer holds back the rest.
      if (chunk.length === 1) {
        for (const part of left) {
          mark(part, "failed");
          part.about.why = together.why;
        }
        continue;
      }
      for (const part of left) {
        const alone = await submit([part]);
        const still = (await present([part])).length > 0;
        if (alone.hash && !still) hashes.push(alone.hash);
        mark(part, still ? "failed" : "done", alone.hash ?? undefined);
        if (still)
          part.about.why =
            alone.why ?? "The ledger did not apply the transaction";
      }
    }
    return { hashes, tickets: settled };
  });
}

export type Listing = { offerId: string; hash: string };

/**
 * Puts a held ticket up for anyone to take at a fixed price. A price of 0 makes it a gift.
 * The ledger keeps the organizer's cut out of the price when the offer is accepted.
 */
export function offerTicket(
  holderSeed: string,
  nftId: string,
  price: number,
): Promise<Listing> {
  return withClient(async (client) => {
    const holder = Wallet.fromSeed(holderSeed);
    const offer = await client.submitAndWait(
      {
        TransactionType: "NFTokenCreateOffer",
        Account: holder.address,
        NFTokenID: nftId,
        Amount: price > 0 ? dollars(price) : "0",
        Flags: SELL_OFFER,
      },
      { wallet: holder },
    );
    assertOk(offer.result.meta, "Offering the ticket");
    const offerId = (
      offer.result.meta as TransactionMetadata & { offer_id?: string }
    ).offer_id;
    if (!offerId) throw new Error("The ledger did not return an offer id");
    return { offerId, hash: offer.result.hash };
  });
}

/** Takes an offer: the ticket moves to the taker and the price moves to the holder, in one transaction. */
export function acceptOffer(takerSeed: string, offerId: string) {
  return withClient(async (client) => {
    const taker = Wallet.fromSeed(takerSeed);
    const accept = await client.submitAndWait(
      {
        TransactionType: "NFTokenAcceptOffer",
        Account: taker.address,
        NFTokenSellOffer: offerId,
      },
      { wallet: taker },
    );
    assertOk(accept.result.meta, "Taking the ticket");
    return { hash: accept.result.hash };
  });
}

export function cancelOffer(holderSeed: string, offerId: string) {
  return withClient(async (client) => {
    const holder = Wallet.fromSeed(holderSeed);
    const cancel = await client.submitAndWait(
      {
        TransactionType: "NFTokenCancelOffer",
        Account: holder.address,
        NFTokenOffers: [offerId],
      },
      { wallet: holder },
    );
    assertOk(cancel.result.meta, "Withdrawing the offer");
    return { hash: cancel.result.hash };
  });
}

export type GateTicket = HeldTicket & {
  /** The account the ticket sits in right now. */
  holder: string;
};

/** What the ledger says about a ticket code. A ticket that is gone was burned or never existed. */
export type GateLookup =
  | { found: true; ticket: GateTicket }
  | { found: false; reason: "gone" | "not-ours" };

/**
 * Finds a ticket on the ledger for the gate. The public server cannot look a ticket up by its id
 * alone, so this reads the account it was last seen in, then the organizer's own.
 */
export function findTicket(
  nftId: string,
  lastSeen: string | null,
): Promise<GateLookup> {
  return withClient(async (client) => {
    const makers = [organizer().address, issuer().address];
    for (const account of new Set([lastSeen ?? makers[0], makers[0]])) {
      let marker: unknown;
      do {
        const page = await client.request({
          command: "account_nfts",
          account,
          limit: 400,
          marker,
        });
        const nft = page.result.account_nfts.find(
          (item) => item.NFTokenID === nftId,
        );
        if (nft) {
          // A ticket a club released was minted by that club's own wallet.
          const read = decode(nft.URI);
          const record =
            read &&
            (makers.includes(nft.Issuer) ||
              nft.Issuer === teamOrganizerAddress(read.team))
              ? read
              : null;
          return record
            ? { found: true, ticket: { ...record, nftId, holder: account } }
            : { found: false, reason: "not-ours" };
        }
        marker = page.result.marker;
      } while (marker);
    }
    // A ticket's id carries the account that minted it, after the flags and the resale cut.
    const maker = encodeAccountID(Buffer.from(nftId.slice(8, 48), "hex"));
    return {
      found: false,
      reason:
        makers.includes(maker) || clubAddresses().has(maker)
          ? "gone"
          : "not-ours",
    };
  });
}

/** The credential the issuer gives the organizer once an event of theirs passes the page check. */
const VERIFIED_ORGANIZER = convertStringToHex("FairseatVerifiedOrganizer");
/** Set on a credential once its subject has accepted it. */
const ACCEPTED = 0x00010000;
/** A credential's URI holds at most this many bytes. */
const URI_LIMIT = 256;

type CredentialEntry = {
  LedgerEntryType: string;
  Issuer?: string;
  CredentialType?: string;
  Flags?: number;
  URI?: string;
  PreviousTxnID?: string;
};

async function readCredential(client: Client) {
  let marker: unknown;
  do {
    const page = await client.request({
      command: "account_objects",
      account: organizer().address,
      type: "credential",
      limit: 400,
      marker,
    });
    const entry = (page.result.account_objects as CredentialEntry[]).find(
      (item) =>
        item.LedgerEntryType === "Credential" &&
        item.Issuer === issuer().address &&
        item.CredentialType === VERIFIED_ORGANIZER,
    );
    if (entry) return entry;
    marker = page.result.marker;
  } while (marker);
  return null;
}

export type OrganizerCredential = {
  /** The last transaction that touched the credential: the organizer accepting it. */
  hash: string;
  /** The official event page it was issued for. */
  page: string | null;
};

/** The organizer's verified credential, read from the ledger. Null until it is issued and accepted. */
export function organizerCredential(): Promise<OrganizerCredential | null> {
  return withClient(async (client) => {
    const entry = await readCredential(client);
    if (!entry?.PreviousTxnID || !((entry.Flags ?? 0) & ACCEPTED)) return null;
    return {
      hash: entry.PreviousTxnID,
      page: entry.URI ? convertHexToString(entry.URI) : null,
    };
  });
}

/**
 * Records on the ledger that the organizer passed the page check: the issuer issues the credential
 * and the organizer accepts it. Done once. Returns the transactions, or null if it was already there.
 */
export function verifyOrganizer(
  officialUrl: string,
): Promise<{ hashes: string[] } | null> {
  return withClient(async (client) => {
    const house = organizer();
    const existing = await readCredential(client);
    if (existing && (existing.Flags ?? 0) & ACCEPTED) return null;

    const hashes: string[] = [];
    if (!existing) {
      // A link too long for the ledger is cut back to its site.
      const uri =
        Buffer.byteLength(officialUrl) <= URI_LIMIT
          ? officialUrl
          : new URL(officialUrl).origin;
      const create = await client.submitAndWait(
        {
          TransactionType: "CredentialCreate",
          Account: issuer().address,
          Subject: house.address,
          CredentialType: VERIFIED_ORGANIZER,
          URI: convertStringToHex(uri),
        },
        { wallet: issuer() },
      );
      assertOk(create.result.meta, "Issuing the organizer credential");
      hashes.push(create.result.hash);
    }
    const accept = await client.submitAndWait(
      {
        TransactionType: "CredentialAccept",
        Account: house.address,
        Issuer: issuer().address,
        CredentialType: VERIFIED_ORGANIZER,
      },
      { wallet: house },
    );
    assertOk(accept.result.meta, "Accepting the organizer credential");
    hashes.push(accept.result.hash);
    return { hashes };
  });
}

/** Who an account is to Fairseat, so a proof can name it in plain words. */
export function accountRole(address: string): "organizer" | "issuer" | "fan" {
  if (address === organizer().address) return "organizer";
  return address === issuer().address ? "issuer" : "fan";
}

/** An amount read off the ledger. XRP is written there as a string of drops, a million to one XRP. */
export type LedgerAmount = { value: number; currency: string };

function readAmount(raw: unknown): LedgerAmount | null {
  if (typeof raw === "string")
    return { value: Number(raw) / 1_000_000, currency: "XRP" };
  if (raw && typeof raw === "object" && "value" in raw && "currency" in raw)
    return { value: Number(raw.value), currency: String(raw.currency) };
  return null;
}

/** One thing a transaction did. A Batch holds several, any other transaction is one. */
export type ProofStep = {
  type: string;
  account: string;
  amount: LedgerAmount | null;
  /** Who the money, the ticket or the credential is for. */
  to: string | null;
  /** Whose escrow, ticket or credential it acts on. */
  owner: string | null;
  nftId: string | null;
  offerId: string | null;
  /** When the fan can take an escrowed payment back, if it was never released. */
  refundAfter: string | null;
  /** A credential's name, and the page it was issued for. */
  credential: string | null;
  page: string | null;
};

export type ProofTransaction = ProofStep & {
  hash: string;
  /** The ledger's result code: tesSUCCESS when it went through. */
  result: string;
  ok: boolean;
  validated: boolean;
  ledgerIndex: number | null;
  closedAt: string | null;
  /** What it cost to submit, in XRP. */
  fee: number;
  /** The transactions inside a Batch, in order. Empty for anything else. */
  parts: ProofStep[];
};

type Fields = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value : null);

/** What an entry looked like when a transaction removed it from the ledger: a paid escrow, a taken offer. */
function removed(meta: TransactionMetadata | undefined, type: string) {
  for (const node of meta?.AffectedNodes ?? [])
    if ("DeletedNode" in node && node.DeletedNode.LedgerEntryType === type)
      return node.DeletedNode.FinalFields as Fields;
  return null;
}

function readStep(tx: Fields, meta?: TransactionMetadata): ProofStep {
  const type = String(tx.TransactionType);
  // An escrow or an offer names its money when it is made. Whatever closes it only points at it.
  const closed =
    type === "EscrowFinish" || type === "EscrowCancel"
      ? removed(meta, "Escrow")
      : type === "NFTokenAcceptOffer"
        ? removed(meta, "NFTokenOffer")
        : null;
  const limit = tx.LimitAmount as { issuer?: string } | undefined;
  const offers = Array.isArray(tx.NFTokenOffers) ? tx.NFTokenOffers : [];
  const made = meta as
    | (TransactionMetadata & { offer_id?: string; delivered_amount?: unknown })
    | undefined;
  return {
    type,
    account: String(tx.Account),
    amount: readAmount(
      made?.delivered_amount ??
        tx.Amount ??
        tx.DeliverMax ??
        tx.LimitAmount ??
        closed?.Amount,
    ),
    to:
      text(tx.Destination) ??
      text(tx.Subject) ??
      text(limit?.issuer) ??
      (type === "NFTokenAcceptOffer" ? null : text(closed?.Destination)),
    owner: text(tx.Owner) ?? text(tx.Issuer) ?? text(closed?.Owner),
    nftId:
      text(tx.NFTokenID) ??
      text(closed?.NFTokenID) ??
      (type === "NFTokenMint" && meta ? (getNFTokenID(meta) ?? null) : null),
    offerId:
      text(tx.NFTokenSellOffer) ?? text(offers[0]) ?? text(made?.offer_id),
    refundAfter:
      typeof tx.CancelAfter === "number"
        ? new Date((tx.CancelAfter + RIPPLE_EPOCH) * 1000).toISOString()
        : null,
    credential:
      typeof tx.CredentialType === "string"
        ? convertHexToString(tx.CredentialType)
        : null,
    page:
      type === "CredentialCreate" && typeof tx.URI === "string"
        ? convertHexToString(tx.URI)
        : null,
  };
}

/** A transaction as the ledger holds it, for a proof page. Null if there is none or it cannot be read. */
export function readTransaction(
  hash: string,
): Promise<ProofTransaction | null> {
  if (!/^[0-9A-F]{64}$/i.test(hash)) return Promise.resolve(null);
  return withClient(async (client) => {
    const found = await client.request({
      command: "tx",
      transaction: hash.toUpperCase(),
    });
    const result = found.result as unknown as {
      tx_json: Fields;
      meta?: TransactionMetadata | string;
      hash: string;
      validated?: boolean;
      ledger_index?: number;
      close_time_iso?: string;
    };
    const tx = result.tx_json;
    const meta = typeof result.meta === "object" ? result.meta : undefined;
    const code = meta?.TransactionResult ?? "unknown";
    const date = typeof tx.date === "number" ? tx.date : null;
    const raw = Array.isArray(tx.RawTransactions) ? tx.RawTransactions : [];
    return {
      ...readStep(tx, meta),
      hash: result.hash,
      result: code,
      ok: code === "tesSUCCESS",
      validated: result.validated === true,
      ledgerIndex: result.ledger_index ?? null,
      closedAt:
        result.close_time_iso ??
        (date === null
          ? null
          : new Date((date + RIPPLE_EPOCH) * 1000).toISOString()),
      fee: Number(tx.Fee ?? 0) / 1_000_000,
      parts: raw.map((part: { RawTransaction: Fields }) =>
        readStep(part.RawTransaction),
      ),
    };
  }).catch(() => null);
}

export type LedgerAccount = {
  address: string;
  xrp: number;
  dollars: number;
  /** How many NFTs the account holds. Every Fairseat ticket is one. */
  nfts: number;
  /** Payments this account has locked in escrow for someone else. */
  lockedByIt: { count: number; dollars: number };
  /** Payments others have locked in escrow for this account. */
  lockedForIt: { count: number; dollars: number };
};

/** An account's balances and what it holds, for a proof page. Null if there is none or it cannot be read. */
export function readAccount(address: string): Promise<LedgerAccount | null> {
  if (!isValidClassicAddress(address)) return Promise.resolve(null);
  return withClient(async (client) => {
    const info = await client.request({
      command: "account_info",
      account: address,
      ledger_index: "validated",
    });
    // The issuer cannot hold its own dollars.
    const dollars =
      address === issuer().address ? 0 : await getBalance(address);

    let nfts = 0;
    let marker: unknown;
    do {
      const page = await client.request({
        command: "account_nfts",
        account: address,
        limit: 400,
        marker,
      });
      nfts += page.result.account_nfts.length;
      marker = page.result.marker;
    } while (marker);

    const lockedByIt = { count: 0, dollars: 0 };
    const lockedForIt = { count: 0, dollars: 0 };
    do {
      const page = await client.request({
        command: "account_objects",
        account: address,
        type: "escrow",
        limit: 400,
        marker,
      });
      for (const entry of page.result.account_objects as unknown as Fields[]) {
        const side = entry.Account === address ? lockedByIt : lockedForIt;
        const amount = readAmount(entry.Amount);
        side.count += 1;
        if (amount?.currency === CURRENCY) side.dollars += amount.value;
      }
      marker = page.result.marker;
    } while (marker);

    return {
      address,
      xrp: Number(info.result.account_data.Balance) / 1_000_000,
      dollars,
      nfts,
      lockedByIt,
      lockedForIt,
    };
  }).catch(() => null);
}
