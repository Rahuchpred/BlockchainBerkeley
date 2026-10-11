import { cacheLife } from "next/cache";
import { NBA_CONFERENCES, NBA_MARKET } from "./data";

// Reads Gemini's public prediction market data. No key is needed for any of this.
const API = "https://api.gemini.com";

type RawContract = {
  label: string;
  status: string;
  instrumentSymbol: string;
  imageUrl?: string;
  resolutionSide?: string;
  prices?: { bestBid?: string; bestAsk?: string; lastTradePrice?: string };
};

type RawEvent = {
  ticker: string;
  title: string;
  status: string;
  imageUrl?: string;
  featuredImageUrl?: string;
  contracts: RawContract[];
};

export type MarketOutcome = {
  team: string;
  /** The Gemini contract, such as GEMI-AFCCHAMP27-BUFFALO. */
  symbol: string;
  image: string | null;
  /** The market's raw price for this team, 0 to 1. */
  chance: number;
  /** The team's share of the seat: its chance divided by the sum of all chances, so the shares add up to 1. */
  share: number;
  /** The team's contract has settled as a no: it can no longer make the final. */
  eliminated: boolean;
};

export type Market = {
  ticker: string;
  title: string;
  image: string | null;
  /** The team whose contract resolved to yes, once the market has settled. */
  settled: string | null;
  /** Highest share first. */
  outcomes: MarketOutcome[];
};

export type Point = { t: number; v: number };

const num = (value: string | undefined) => {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) ? parsed : null;
};

/** The middle of the bid and the ask when both exist, since the last trade can be days old. */
function chanceOf(contract: RawContract) {
  const bid = num(contract.prices?.bestBid);
  const ask = num(contract.prices?.bestAsk);
  const last = num(contract.prices?.lastTradePrice);
  if (bid !== null && ask !== null) return (bid + ask) / 2;
  return last ?? ask ?? bid ?? 0;
}

export async function getMarket(ticker: string): Promise<Market> {
  "use cache";
  cacheLife("seconds");

  // An NBA conference is not a market of its own on Gemini: it is its teams' part of the league market.
  const conference = NBA_CONFERENCES[ticker];
  const source = conference ? NBA_MARKET : ticker;
  const response = await fetch(`${API}/v1/prediction-markets/events/${source}`);
  if (!response.ok)
    throw new Error(`Gemini market ${source} returned ${response.status}`);
  const event = (await response.json()) as RawEvent;
  const contracts = conference
    ? event.contracts.filter((contract) =>
        conference.teams.includes(contract.label),
      )
    : event.contracts;

  const winner = contracts.find(
    (contract) => contract.resolutionSide === "yes",
  );
  const raw = contracts.map((contract) => ({
    team: contract.label,
    symbol: contract.instrumentSymbol,
    image: contract.imageUrl ?? null,
    eliminated:
      contract.status === "settled" && contract.resolutionSide !== "yes",
    chance: winner
      ? contract === winner
        ? 1
        : 0
      : contract.status === "settled"
        ? 0
        : chanceOf(contract),
  }));
  const total = raw.reduce((sum, outcome) => sum + outcome.chance, 0);

  return {
    ticker,
    title: conference?.title ?? event.title,
    image: event.featuredImageUrl ?? event.imageUrl ?? null,
    settled: winner?.label ?? null,
    outcomes: raw
      .map((outcome) => ({
        ...outcome,
        share: total > 0 ? outcome.chance / total : 0,
      }))
      .sort((a, b) => b.share - a.share),
  };
}

export type Frame = "1hr" | "6hr" | "1day";

/** Closing prices for one contract, oldest first, in percent. */
export async function getHistory(
  symbol: string,
  frame: Frame,
): Promise<Point[]> {
  "use cache";
  cacheLife("minutes");

  const response = await fetch(`${API}/v2/candles/${symbol}/${frame}`);
  if (!response.ok) return [];
  const candles = (await response.json()) as number[][];
  return candles
    .map(([t, , , , close]) => ({ t, v: Math.round(close * 100) }))
    .reverse();
}
