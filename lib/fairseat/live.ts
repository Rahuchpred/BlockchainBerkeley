import { connection } from "next/server";
import {
  WATCHING,
  getSeat,
  getSide,
  priceFor,
  slug,
  type FairEvent,
  type Seat,
  type Side,
  type Ticket,
} from "./data";
import { getHistory, getMarket, type MarketOutcome } from "./gemini";
import {
  offerFor,
  releasedTicket,
  soldTicket,
  stagedResult,
  ticketKey,
} from "./store";

/** How many teams get their own color. The rest share the neutral one. */
export const TONES = 8;

export type LiveOutcome = MarketOutcome & {
  slug: string;
  /** 1 to 8 for the eight likeliest teams, 0 for the rest. Picks the team's color. */
  tone: number;
};

export type LiveSide = Side & {
  title: string;
  image: string | null;
  /** The team that made the final, once the market has settled. */
  settled: string | null;
  /** Every team in the market, likeliest first. */
  outcomes: LiveOutcome[];
  /** The teams a ticket can still be bought for. */
  onSale: LiveOutcome[];
};

export async function loadSide(side: Side): Promise<LiveSide> {
  // Odds are read when a fan asks for the page, never baked in when the site is built.
  await connection();
  const market = await getMarket(side.market);
  // A result staged for the demo stands in for the market settling, which no market has done yet.
  const staged = stagedResult(side.market);
  const winner =
    market.settled ??
    market.outcomes.find((outcome) => outcome.team === staged)?.team ??
    null;
  const outcomes = market.outcomes.map((outcome, index) => {
    const live = winner
      ? {
          ...outcome,
          chance: outcome.team === winner ? 1 : 0,
          share: outcome.team === winner ? 1 : 0,
          eliminated: outcome.team !== winner,
        }
      : outcome;
    return {
      ...live,
      slug: slug(live.team),
      tone: !live.eliminated && live.share > 0 && index < TONES ? index + 1 : 0,
    };
  });
  return {
    ...side,
    title: market.title,
    image: market.image,
    settled: winner,
    outcomes,
    onSale: winner
      ? []
      : outcomes.filter((outcome) => !outcome.eliminated && outcome.share > 0),
  };
}

export const loadSides = (event: FairEvent) =>
  Promise.all(event.sides.map(loadSide));

/** How many teams need a price before a watched market's odds mean anything. */
const WATCH_MIN = 3;

export type WatchedMarket = {
  ticker: string;
  title: string;
  /** Why no tickets are sold on this market. */
  reason: string;
  /** The priced teams, likeliest first. Empty when too few teams have a price. */
  outcomes: LiveOutcome[];
};

/** The markets Fairseat watches but does not sell on. One that fails to load or has settled is left out. */
export async function loadWatched(): Promise<WatchedMarket[]> {
  await connection();
  const watched = await Promise.all(
    WATCHING.map(async ({ market: ticker, reason }) => {
      const market = await getMarket(ticker).catch(() => null);
      if (!market || market.settled) return null;
      const priced = market.outcomes.filter(
        (outcome) => !outcome.eliminated && outcome.chance > 0,
      );
      return {
        ticker,
        title: market.title,
        reason,
        outcomes:
          priced.length < WATCH_MIN
            ? []
            : priced.map((outcome, index) => ({
                ...outcome,
                slug: slug(outcome.team),
                tone: index < TONES ? index + 1 : 0,
              })),
      };
    }),
  );
  return watched.filter((market) => market !== null);
}

/**
 * What each ticket for a seat that can be bought right now costs. Where clubs sell their own
 * tickets, that is only the ones a club has released: at the live price while unsold, or at the
 * holder's asking price while listed for resale. A team that has released nothing has no price.
 */
export function pricesOnSale(event: FairEvent, seat: Seat, side: LiveSide) {
  if (!event.teamWallets)
    return side.onSale.map((outcome) => priceFor(seat, outcome.share));
  return side.onSale.flatMap((outcome) => {
    const key = ticketKey(event.id, seat.id, outcome.slug);
    if (!releasedTicket(key)) return [];
    const sold = soldTicket(key);
    if (!sold) return [priceFor(seat, outcome.share)];
    const offer = offerFor(sold);
    return offer && offer.price > 0 ? [offer.price] : [];
  });
}

/** The cheapest ticket still on sale across an event's seats. */
export function fromPrice(event: FairEvent, sides: LiveSide[]) {
  const prices = event.seats.flatMap((seat) => {
    const side = sides.find((item) => item.id === seat.side);
    return side ? pricesOnSale(event, seat, side) : [];
  });
  return prices.length ? Math.min(...prices) : null;
}

/** How far the market's price for a team moved since yesterday's close, in percentage points. */
export async function changeToday(symbol: string) {
  const days = await getHistory(symbol, "1day");
  if (days.length < 2) return 0;
  return days[days.length - 1].v - days[days.length - 2].v;
}

export type TicketStatus = "open" | "live" | "expired";

export type TicketView = {
  ticket: Ticket;
  event: FairEvent;
  seat: Seat;
  side: LiveSide;
  outcome: LiveOutcome;
  status: TicketStatus;
  /** What the ticket would sell for now. A live ticket is worth the whole seat, an expired one nothing. */
  worth: number;
};

export async function viewTicket(
  ticket: Ticket,
  event: FairEvent | undefined,
): Promise<TicketView | null> {
  const seat = event && getSeat(event, ticket.seatId);
  const config = event && seat && getSide(event, seat.side);
  if (!event || !seat || !config) return null;
  const side = await loadSide(config);
  const outcome = side.outcomes.find((item) => item.slug === slug(ticket.team));
  if (!outcome) return null;
  const status: TicketStatus =
    side.settled === outcome.team
      ? "live"
      : side.settled || outcome.eliminated
        ? "expired"
        : "open";
  const worth =
    status === "live"
      ? seat.faceValue
      : status === "expired"
        ? 0
        : priceFor(seat, outcome.share);
  return { ticket, event, seat, side, outcome, status, worth };
}
