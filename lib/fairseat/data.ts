// The events and their seats. Odds, prices, images and results are not here: they come live
// from Gemini, through lib/fairseat/live.ts.

/**
 * What a team must do for its ticket to become the seat, in each form a sentence needs. A side
 * without one is decided by who makes this event's own final.
 */
export type Condition = {
  /** After "If the team": "make the final". */
  make: string;
  /** After "the team that": "makes the final". */
  makes: string;
  /** After the team's name, once it has: "made the final". */
  made: string;
  /** After "chance of": "making the final". */
  making: string;
  /** After the team's name, once it is out: "missed the final". */
  missed: string;
  /** What every ticket waits for: "the finalists are decided". */
  decided: string;
};

export type Side = {
  id: string;
  name: string;
  /** The Gemini market that prices and settles this side. */
  market: string;
  /** Set when the market prices something other than a place in this event's own final. */
  condition?: Condition;
};

const MAKES_THE_FINAL: Condition = {
  make: "make the final",
  makes: "makes the final",
  made: "made the final",
  making: "making the final",
  missed: "missed the final",
  decided: "the finalists are decided",
};

const WINS_THE_CHAMPIONS_LEAGUE: Condition = {
  make: "win the Champions League",
  makes: "wins the Champions League",
  made: "won the Champions League",
  making: "winning the Champions League",
  missed: "did not win the Champions League",
  decided: "the Champions League winner is decided",
};

/** The words for what decides a side's seats. */
export const conditionOf = (side?: { condition?: Condition } | null) =>
  side?.condition ?? MAKES_THE_FINAL;

/** Who a side's seats are for, to follow "for fans of" or "a fan of". */
export const fansOf = (side: Pick<Side, "name" | "condition">) =>
  side.condition
    ? `the team that ${side.condition.makes}`
    : `the ${side.name.replace(/ side$/, "")} team that makes the final`;

export type Seat = {
  id: string;
  side: string;
  section: string;
  row: string;
  seat: string;
  /** The full price of the seat. The tickets for all teams add up to this. */
  faceValue: number;
};

export type Sport = "Football" | "Baseball" | "Soccer" | "NBA";

/** The shape of a venue's seating bowl: rings of numbered sections around the field, inner ring first. */
export type VenueMap = {
  field: "football" | "baseball" | "soccer" | "basketball";
  rings: { first: number; count: number }[];
};

export type FairEvent = {
  id: string;
  title: string;
  sport: Sport;
  /** ISO date. */
  date: string;
  venue: string;
  city: string;
  officialUrl: string;
  /** The first half of each ring belongs to the first side, the second half to the second. */
  map: VenueMap;
  sides: Side[];
  seats: Seat[];
  /** For an event an organizer listed: the site whose page its details were checked against. */
  checkedAgainst?: string;
  /**
   * Each team sells its own tickets: they are minted by, and paid to, that team's own organizer
   * wallet, and a ticket is only on sale once its team has released it.
   */
  teamWallets?: boolean;
};

/** A ticket a fan holds. The id is the ticket's id on the ledger. */
export type Ticket = {
  id: string;
  eventId: string;
  seatId: string;
  /** The team's slug. */
  team: string;
  paid: number;
};

/** The share of each sale Fairseat keeps. */
export const FEE_RATE = 0.025;

/** The rows and seats a section holds. Fairseat sells a few of them. */
export const SECTION = { rows: 10, seats: 16 };

/** The seats Fairseat sells in one section, all at the same full price. */
export const seats = (
  side: string,
  section: string,
  faceValue: number,
): Seat[] =>
  [
    ["3", "12"],
    ["3", "13"],
    ["3", "14"],
    ["3", "15"],
    ["8", "4"],
    ["8", "5"],
    ["8", "6"],
  ].map(([row, seat]) => ({
    id: `${section}-${row}-${seat}`,
    side,
    section,
    row,
    seat,
    faceValue,
  }));

export const EVENTS: FairEvent[] = [
  {
    id: "pro-football-championship-2027",
    title: "Pro Football Championship",
    sport: "Football",
    date: "2027-02-14",
    venue: "SoFi Stadium",
    city: "Inglewood, CA",
    officialUrl: "https://www.sofistadium.com",
    map: {
      field: "football",
      rings: [
        { first: 101, count: 40 },
        { first: 301, count: 40 },
      ],
    },
    sides: [
      { id: "afc", name: "AFC side", market: "AFCCHAMP27" },
      { id: "nfc", name: "NFC side", market: "NFCCHAMP27" },
    ],
    seats: [
      ...seats("afc", "104", 1200),
      ...seats("nfc", "132", 1200),
      ...seats("afc", "318", 640),
    ],
  },
  {
    id: "world-series-2026-game-1",
    title: "World Series, Game 1",
    sport: "Baseball",
    date: "2026-10-23",
    venue: "Dodger Stadium",
    city: "Los Angeles, CA",
    officialUrl: "https://www.mlb.com/dodgers/ballpark",
    map: { field: "baseball", rings: [{ first: 1, count: 48 }] },
    sides: [
      { id: "al", name: "American League side", market: "ALCHAMP26" },
      { id: "nl", name: "National League side", market: "NLCHAMP26" },
    ],
    seats: [...seats("al", "24", 480), ...seats("nl", "41", 480)],
  },
  {
    id: "nba-finals-2027-game-1",
    title: "NBA Finals, Game 1",
    sport: "NBA",
    date: "2027-06-03",
    venue: "Chase Center",
    city: "San Francisco, CA",
    officialUrl: "https://www.nba.com",
    map: {
      field: "basketball",
      rings: [
        { first: 101, count: 30 },
        { first: 201, count: 30 },
      ],
    },
    sides: [
      { id: "east", name: "Eastern Conference side", market: "NBAEAST27" },
      { id: "west", name: "Western Conference side", market: "NBAWEST27" },
    ],
    seats: [
      ...seats("east", "104", 900),
      ...seats("west", "119", 900),
      ...seats("east", "208", 420),
      ...seats("west", "223", 420),
    ],
    teamWallets: true,
  },
  // Gemini prices who wins the Champions League, not who reaches its final, so it cannot price a
  // seat at that final. The winner does play the Super Cup, at a venue UEFA fixed in advance.
  {
    id: "uefa-super-cup-2027",
    title: "UEFA Super Cup 2027",
    sport: "Soccer",
    date: "2027-08-11",
    venue: "Johan Cruyff ArenA",
    city: "Amsterdam, Netherlands",
    officialUrl:
      "https://www.uefa.com/uefasupercup/news/02a9-2198b459d375-97fdf1034979-1000--2027-and-2028-super-cup-venues-confirmed/",
    map: {
      field: "soccer",
      rings: [
        { first: 101, count: 36 },
        { first: 401, count: 36 },
      ],
    },
    sides: [
      {
        id: "ucl",
        name: "Champions League winner's side",
        market: "UCL2627",
        condition: WINS_THE_CHAMPIONS_LEAGUE,
      },
    ],
    seats: [...seats("ucl", "112", 900), ...seats("ucl", "418", 420)],
  },
];

/** Gemini's one market for the whole league: which of the 30 teams wins the title. */
export const NBA_MARKET = "NBAF-2627CHAMP";

/**
 * Gemini has no market for who wins each conference, so each one is cut out of the league market:
 * the conference's 15 teams, with their title chances shared out between them. The names are
 * Gemini's labels. See getMarket in lib/fairseat/gemini.ts.
 */
export const NBA_CONFERENCES: Record<
  string,
  { title: string; teams: string[] }
> = {
  NBAEAST27: {
    title: "Eastern Conference Champion",
    teams: [
      "Atlanta",
      "Boston",
      "Brooklyn",
      "Charlotte",
      "Chicago",
      "Cleveland",
      "Detroit",
      "Indiana",
      "Miami",
      "Milwaukee",
      "New York",
      "Orlando",
      "Philadelphia",
      "Toronto",
      "Washington",
    ],
  },
  NBAWEST27: {
    title: "Western Conference Champion",
    teams: [
      "Dallas",
      "Denver",
      "Golden State",
      "Houston",
      "LA Clippers",
      "LA Lakers",
      "Memphis",
      "Minnesota",
      "New Orleans",
      "Oklahoma City",
      "Phoenix",
      "Portland",
      "Sacramento",
      "San Antonio",
      "Utah",
    ],
  },
};

export const slug = (team: string) =>
  team
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const getSeat = (event: FairEvent, seatId: string) =>
  event.seats.find((seat) => seat.id === seatId);
export const getSide = (event: FairEvent, sideId: string) =>
  event.sides.find((side) => side.id === sideId);

/**
 * The seats that can be bought together with one: the unbroken run of free seats around it in its
 * row, lowest number first. A seat that is not free, or a gap in the numbers, ends the run.
 */
export function seatsBeside(
  event: FairEvent,
  seat: Seat,
  free: (seat: Seat) => boolean,
) {
  const row = event.seats
    .filter(
      (item) =>
        item.side === seat.side &&
        item.section === seat.section &&
        item.row === seat.row,
    )
    .sort((a, b) => Number(a.seat) - Number(b.seat));
  const next = (a: Seat, b: Seat) =>
    Number(b.seat) === Number(a.seat) + 1 && free(a) && free(b);
  let from = row.findIndex((item) => item.id === seat.id);
  let to = from;
  while (from > 0 && next(row[from - 1], row[from])) from -= 1;
  while (to < row.length - 1 && next(row[to], row[to + 1])) to += 1;
  return row.slice(from, to + 1);
}

/** The seats a group of this size takes from a run: the chosen one, the ones after it, then the ones before. */
export function groupOf(run: Seat[], seat: Seat, size: number) {
  const at = run.findIndex((item) => item.id === seat.id);
  const from = Math.max(0, Math.min(at, run.length - size));
  return run.slice(from, from + size);
}

/** A team's ticket costs the seat's full price times the team's share of it. */
export const priceFor = (seat: Seat, share: number) =>
  Math.round(seat.faceValue * share * 100) / 100;

export const feeFor = (price: number) =>
  Math.round(price * FEE_RATE * 100) / 100;

/** The venue and, when known, its city. */
export const placeOf = (event: FairEvent) =>
  event.city ? `${event.venue}, ${event.city}` : event.venue;

/** The markets an organizer can price an event with, and the kind of venue each one implies. */
export const MARKETS: Record<
  string,
  {
    label: string;
    sport: Sport;
    side: string;
    map: VenueMap;
    condition?: Condition;
  }
> = {
  AFCCHAMP27: {
    label: "AFC Championship Winner",
    sport: "Football",
    side: "AFC side",
    map: { field: "football", rings: [{ first: 101, count: 40 }] },
  },
  NFCCHAMP27: {
    label: "NFC Championship Winner",
    sport: "Football",
    side: "NFC side",
    map: { field: "football", rings: [{ first: 101, count: 40 }] },
  },
  ALCHAMP26: {
    label: "American League Champion",
    sport: "Baseball",
    side: "American League side",
    map: { field: "baseball", rings: [{ first: 1, count: 48 }] },
  },
  NLCHAMP26: {
    label: "National League Champion",
    sport: "Baseball",
    side: "National League side",
    map: { field: "baseball", rings: [{ first: 1, count: 48 }] },
  },
  UCL2627: {
    label: "Champions League Winner",
    sport: "Soccer",
    side: "Champions League winner's side",
    map: { field: "soccer", rings: [{ first: 101, count: 36 }] },
    condition: WINS_THE_CHAMPIONS_LEAGUE,
  },
};

/**
 * Gemini sports markets Fairseat shows the odds of but sells no tickets on, each with the reason
 * in one line.
 */
export const WATCHING: { market: string; reason: string }[] = [
  {
    market: "CFBPLAYOFF2627",
    reason: "Twelve teams qualify, so one seat cannot go to one winner.",
  },
  {
    market: "PROFB2027",
    reason:
      "This prices who wins the final, not who plays in it. The conference markets price the seats.",
  },
  {
    market: "BASEBALL26",
    reason:
      "This prices who wins the series, not who plays in it. The league markets price the seats.",
  },
  {
    market: "NHLSTANLEYCUP27",
    reason:
      "The final is played in the two finalists' own rinks, so no seat is known yet.",
  },
  {
    market: "MLSCUP26",
    reason:
      "The final is hosted by one of the finalists, so the stadium is not known yet.",
  },
  {
    market: "EPLCHAMP27",
    reason: "A league title is won over a season. There is no final to seat.",
  },
  { market: "MLSEAST26", reason: "No one is trading this yet." },
  { market: "MLSWEST26", reason: "No one is trading this yet." },
];

export const seatLabel = (seat: Seat) =>
  `Section ${seat.section}, row ${seat.row}, seat ${seat.seat}`;

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export const formatDate = (iso: string) =>
  dateFormat.format(new Date(`${iso}T12:00:00Z`));

export const percent = (share: number) => {
  const value = share * 100;
  return value > 0 && value < 1 ? "Under 1%" : `${Math.round(value)}%`;
};
