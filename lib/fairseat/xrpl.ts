import {
  Client,
  Wallet,
  convertHexToString,
  convertStringToHex,
  getNFTokenID,
  type TransactionMetadata,
} from "xrpl";

// Everything Fairseat does on the XRP Ledger testnet.
//
// - One issuer account mints the tickets and issues the test dollars fans pay with.
// - A ticket is an NFT whose URI names the event, the seat and the team.
// - Buying is one NFTokenAcceptOffer: the ledger moves the dollars and the ticket together, or neither.

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

export const issuerAddress = () => issuer().address;

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
        const record = nft.Issuer === issuer().address ? decode(nft.URI) : null;
        if (record) held.push({ ...record, nftId: nft.NFTokenID });
      }
      marker = page.result.marker;
    } while (marker);
    return held;
  });
}

export type Purchase = { nftId: string; hash: string };

/** Mints the ticket, offers it to the fan for the price, and has the fan accept: payment and ticket swap in one transaction. */
export function buyTicket(
  fanSeed: string,
  record: TicketRecord,
): Promise<Purchase> {
  return withClient(async (client) => {
    const fan = Wallet.fromSeed(fanSeed);
    const house = issuer();

    const mint = await client.submitAndWait(
      {
        TransactionType: "NFTokenMint",
        Account: house.address,
        NFTokenTaxon: 0,
        Flags: TRANSFERABLE | BURNABLE,
        TransferFee: RESALE_CUT,
        URI: encode(record),
      },
      { wallet: house },
    );
    assertOk(mint.result.meta, "Minting the ticket");
    const nftId = getNFTokenID(mint.result.meta as TransactionMetadata);
    if (!nftId) throw new Error("The ledger did not return a ticket id");

    const offer = await client.submitAndWait(
      {
        TransactionType: "NFTokenCreateOffer",
        Account: house.address,
        NFTokenID: nftId,
        Amount: dollars(record.paid),
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

    const accept = await client.submitAndWait(
      {
        TransactionType: "NFTokenAcceptOffer",
        Account: fan.address,
        NFTokenSellOffer: offerId,
      },
      { wallet: fan },
    );
    assertOk(accept.result.meta, "Paying for the ticket");
    return { nftId, hash: accept.result.hash };
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
