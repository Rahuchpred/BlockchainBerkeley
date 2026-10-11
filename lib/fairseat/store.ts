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

// Which tickets a team's organizer has released: minted into its account, on sale until one is sold.
export const releasedTicket = (key: string) =>
  read<Sold>("released.json", {})[key] ?? null;

export function recordReleases(tickets: { key: string; nftId: string }[]) {
  write("released.json", {
    ...read<Sold>("released.json", {}),
    ...Object.fromEntries(tickets.map((ticket) => [ticket.key, ticket.nftId])),
  });
}

/** Forgets a released ticket that is gone from the ledger, so its club can release it again. */
export function forgetRelease(nftId: string) {
  write(
    "released.json",
    Object.fromEntries(
      Object.entries(read<Sold>("released.json", {})).filter(
        ([, id]) => id !== nftId,
      ),
    ),
  );
}

/** Every ticket a team has released, sold or not, as its key and its id on the ledger. */
export const releasedTickets = () =>
  Object.entries(read<Sold>("released.json", {})).map(([key, nftId]) => {
    const [eventId, seatId, team] = key.split("|");
    return { eventId, seatId, team, nftId };
  });

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
  /** Payments still locked in an escrow on the ledger, by ticket id. */
  escrows?: Record<string, Escrow>;
  /** Who holds each ticket now, so an expired one can be burned. */
  holders?: Record<string, string>;
  /** The transactions that settled each market on the ledger. */
  settled?: Record<string, string[]>;
  /** Demo only: new purchases get a refund deadline minutes away instead of a month after the event. */
  quickRefunds?: boolean;
};

/** A fan's payment for a ticket, held on the ledger until the finalists are decided. */
export type Escrow = {
  owner: string;
  sequence: number;
  amount: number;
  /** When the fan can take it back, as an ISO time, if that is not the event's usual deadline. */
  refundAfter?: string;
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

export const escrowFor = (nftId: string) => market().escrows?.[nftId] ?? null;

export function saveEscrow(nftId: string, escrow: Escrow) {
  const state = market();
  write("market.json", {
    ...state,
    escrows: { ...state.escrows, [nftId]: escrow },
  });
}

/** Forgets an escrow that is no longer on the ledger, because the fan took the payment back. */
export function clearEscrow(nftId: string) {
  const state = market();
  const escrows = { ...state.escrows };
  delete escrows[nftId];
  write("market.json", { ...state, escrows });
}

export const holderOf = (nftId: string) => market().holders?.[nftId] ?? null;

export function recordHolder(nftId: string, address: string) {
  const state = market();
  write("market.json", {
    ...state,
    holders: { ...state.holders, [nftId]: address },
  });
}

/** Every ticket ever sold, as its key and its id on the ledger. */
export const soldTickets = () =>
  Object.entries(read<Sold>("sold.json", {})).map(([key, nftId]) => {
    const [eventId, seatId, team] = key.split("|");
    return { eventId, seatId, team, nftId };
  });

export const ledgerSettlement = (ticker: string) =>
  market().settled?.[ticker] ?? null;

/**
 * Records what a settlement really did on the ledger: these payments are no longer in escrow and
 * these tickets are gone. Anything left out stays as it was, so the settlement can be run again.
 */
export function recordSettled(released: string[], burned: string[]) {
  const state = market();
  const escrows = { ...state.escrows };
  for (const nftId of released) delete escrows[nftId];
  const offers = { ...state.offers };
  for (const nftId of burned) delete offers[nftId];
  write("market.json", { ...state, escrows, offers });
}

/** Records that a market is settled on the ledger in full, with the transactions that did it. */
export function recordSettlement(ticker: string, hashes: string[]) {
  const state = market();
  write("market.json", {
    ...state,
    settled: { ...state.settled, [ticker]: hashes },
  });
}

/**
 * Forgets a ticket that was refunded and burned: its sale, its escrow, its holder and any open
 * offer. The seat's ticket for that team can then be sold again.
 */
export function forgetTicket(nftId: string) {
  const sold = read<Sold>("sold.json", {});
  write(
    "sold.json",
    Object.fromEntries(Object.entries(sold).filter(([, id]) => id !== nftId)),
  );
  const state = market();
  const without = <T>(items: Record<string, T> | undefined) => {
    const kept = { ...items };
    delete kept[nftId];
    return kept;
  };
  write("market.json", {
    ...state,
    offers: without(state.offers),
    paid: without(state.paid),
    escrows: without(state.escrows),
    holders: without(state.holders),
  });
}

/** One step in a ticket's life, as it happened on the ledger. */
export type Activity = {
  /** When it happened, as an ISO time. */
  at: string;
  kind:
    | "minted"
    | "bought"
    | "listed"
    | "unlisted"
    | "resold"
    | "sent"
    | "claimed"
    | "released"
    | "refunded"
    | "burned";
  nftId: string;
  eventId: string;
  seatId: string;
  team: string;
  /** Dollars moved or asked, where the step has an amount. */
  amount?: number;
  /** The transaction on the ledger. */
  hash?: string;
  /** The account that paid or gave. */
  from?: string;
  /** The account that received. */
  to?: string;
  /** On a burn: the fan took the payment back, so the ticket was handed back, not expired. */
  returned?: boolean;
};

/** Every recorded step, oldest first. */
export const allActivity = () => read<Activity[]>("activity.json", []);

export const activityFor = (nftId: string) =>
  allActivity().filter((item) => item.nftId === nftId);

export function logActivity(...items: Omit<Activity, "at">[]) {
  const at = new Date().toISOString();
  write("activity.json", [
    ...allActivity(),
    ...items.map((item) => ({ at, ...item })),
  ]);
}

/** Every payment still locked in an escrow, by ticket id. */
export const pendingEscrows = () => market().escrows ?? {};

/** Demo only: whether new purchases get a short refund deadline. */
export const quickRefunds = () => market().quickRefunds === true;

export function setQuickRefunds(on: boolean) {
  write("market.json", { ...market(), quickRefunds: on });
}
