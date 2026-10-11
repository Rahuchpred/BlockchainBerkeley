import { createHash } from "node:crypto";
import {
  Client,
  Wallet,
  convertHexToString,
  convertStringToHex,
  getNFTokenID,
  hashes,
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

export const txUrl = (hash: string) => `${EXPLORER}/transactions/${hash}`;
export const accountUrl = (address: string) =>
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
  return withClient(async (client) => {
    const fan = Wallet.fromSeed(fanSeed);
    const house = organizer();

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

    try {
      const paid = await payAndTake(
        client,
        fan,
        house.address,
        nftId,
        meta.offer_id,
        record.paid,
        refundAfter,
      );
      return { nftId, mintHash: mint.result.hash, ...paid };
    } catch (error) {
      // The fan did not pay, so the ticket must not be left waiting for them.
      await client
        .submitAndWait(
          {
            TransactionType: "NFTokenBurn",
            Account: house.address,
            NFTokenID: nftId,
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

export type Settlement = {
  nftId: string;
  /** The escrow holding what was paid for this ticket, if it has not been released yet. */
  escrow: { owner: string; sequence: number } | null;
  /** Who holds the ticket now, if it is to be burned because its team missed the final. */
  burnFrom: string | null;
};

/**
 * Settles tickets once the finalists are decided: releases each payment to the organizer and burns
 * the tickets for teams that missed out. Returns the transactions that did it. Tickets a team
 * released are settled by that team's own organizer, so name the team.
 */
export function settleTickets(
  tickets: Settlement[],
  team?: string,
): Promise<{ hashes: string[]; byTicket: Record<string, string> }> {
  return withClient(async (client) => {
    const house = team ? teamOrganizer(team) : organizer();
    const parts = tickets.flatMap((ticket) => [
      ...(ticket.escrow
        ? [
            {
              nftId: ticket.nftId,
              tx: {
                TransactionType: "EscrowFinish",
                Account: house.address,
                Owner: ticket.escrow.owner,
                OfferSequence: ticket.escrow.sequence,
                Condition: escrowLock(ticket.nftId).condition,
                Fulfillment: escrowLock(ticket.nftId).fulfillment,
              },
            },
          ]
        : []),
      ...(ticket.burnFrom
        ? [
            {
              nftId: ticket.nftId,
              tx: {
                TransactionType: "NFTokenBurn",
                Account: house.address,
                // A ticket nobody bought is still in the organizer's own account.
                ...(ticket.burnFrom !== house.address && {
                  Owner: ticket.burnFrom,
                }),
                NFTokenID: ticket.nftId,
              },
            },
          ]
        : []),
    ]);
    const hashes: string[] = [];
    const byTicket: Record<string, string> = {};
    for (let at = 0; at < parts.length; at += BATCH_LIMIT) {
      const chunk = parts.slice(at, at + BATCH_LIMIT);
      const done = await submitTogether(
        client,
        house,
        chunk.map((part) => part.tx),
        "Settling the tickets",
      );
      hashes.push(done.hash);
      for (const part of chunk) byTicket[part.nftId] = done.hash;
    }
    return { hashes, byTicket };
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
