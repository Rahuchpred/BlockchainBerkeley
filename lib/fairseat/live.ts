import {
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
import { stagedResult } from "./store";

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

/** The cheapest ticket still on sale across an event's seats. */
export function fromPrice(event: FairEvent, sides: LiveSide[]) {
  const prices = event.seats.flatMap((seat) => {
    const side = sides.find((item) => item.id === seat.side);
    return side
      ? side.onSale.map((outcome) => priceFor(seat, outcome.share))
      : [];
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
