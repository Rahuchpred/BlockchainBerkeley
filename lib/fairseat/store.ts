import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FairEvent } from "./data";

// The small amount of state Fairseat keeps beside the ledger. The ledger holds the tickets and the
// offers themselves; these files only make them quick to look up without scanning every account.
const DIR = join(process.cwd(), ".data");

function read<T>(name: string, empty: T): T {
  const file = join(DIR, name);
  try {
    return existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as T)
      : empty;
  } catch {
    return empty;
  }
}

function write(name: string, value: unknown) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, name), JSON.stringify(value, null, 2));
}

// Which team tickets have been sold, so the same one is never minted twice.
type Sold = Record<string, string>;

export const ticketKey = (eventId: string, seatId: string, team: string) =>
  `${eventId}|${seatId}|${team}`;

export const soldTicket = (key: string) =>
  read<Sold>("sold.json", {})[key] ?? null;

export function recordSale(key: string, nftId: string) {
  write("sold.json", { ...read<Sold>("sold.json", {}), [key]: nftId });
}

/** An offer a holder has open on the ledger for one of their tickets. A price of 0 is a gift. */
export type Offer = {
  offerId: string;
  price: number;
  /** The holder's address. */
  from: string;
  eventId: string;
  seatId: string;
  team: string;
};

type Market = {
  /** Open offers, by ticket id. */
  offers: Record<string, Offer>;
  /** What the current holder paid, for tickets that changed hands after the first sale. */
  paid: Record<string, number>;
  /** Staged results for the demo, by Gemini market: the team said to have made the final. */
  staged: Record<string, string>;
};

const market = () =>
  read<Market>("market.json", { offers: {}, paid: {}, staged: {} });

export const offerFor = (nftId: string) => market().offers[nftId] ?? null;

export function findOffer(offerId: string) {
  const found = Object.entries(market().offers).find(
    ([, offer]) => offer.offerId === offerId,
  );
  return found ? { nftId: found[0], ...found[1] } : null;
}

export function saveOffer(nftId: string, offer: Offer) {
  const state = market();
  write("market.json", {
    ...state,
    offers: { ...state.offers, [nftId]: offer },
  });
}

export function clearOffer(nftId: string) {
  const state = market();
  const offers = { ...state.offers };
  delete offers[nftId];
  write("market.json", { ...state, offers });
}

export const paidFor = (nftId: string): number | null =>
  market().paid[nftId] ?? null;

export function recordPaid(nftId: string, paid: number) {
  const state = market();
  write("market.json", { ...state, paid: { ...state.paid, [nftId]: paid } });
}

export const stagedResult = (ticker: string) => market().staged[ticker] ?? null;

export function stageResult(ticker: string, team: string | null) {
  const state = market();
  const staged = { ...state.staged };
  if (team) staged[ticker] = team;
  else delete staged[ticker];
  write("market.json", { ...state, staged });
}

/** The events organizers have listed, after their details passed the page check. */
export const listedEvents = () => read<FairEvent[]>("events.json", []);

export function saveEvent(event: FairEvent) {
  write("events.json", [...listedEvents(), event]);
}
