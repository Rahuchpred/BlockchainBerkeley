// The events and their seats. Odds, prices, images and results are not here: they come live
// from Gemini, through lib/fairseat/live.ts.

export type Side = {
  id: string;
  name: string;
  /** The Gemini market that prices and settles this side. */
  market: string;
};

export type Seat = {
  id: string;
  side: string;
  section: string;
  row: string;
  seat: string;
  /** The full price of the seat. The tickets for all teams add up to this. */
  faceValue: number;
};

export type Sport = "Football" | "Baseball" | "NBA";

/** The shape of a venue's seating bowl: rings of numbered sections around the field, inner ring first. */
export type VenueMap = {
  field: "football" | "baseball" | "basketball";
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
  /**
   * The whole arena is open: a team may release its ticket for any seat on its side, and `seats`
   * is the seats some team has released. This is the full price of a seat in each ring, inner first.
   */
  ringPrices?: number[];
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

/** The demo's buyer: the username of the account that holds the fan wallet. */
export const BUYER_NAME = "Mike";

/** The username of the organizer account for the events the single organizer wallet sells. */
export const HOUSE_NAME = "Fairseat";

/** Each NBA team's code, by its name on Gemini. A team's organizer logs in with the code. */
export const NBA_CODES: Record<string, string> = {
  Atlanta: "ATL",
  Boston: "BOS",
  Brooklyn: "BKN",
  Charlotte: "CHA",
  Chicago: "CHI",
  Cleveland: "CLE",
  Detroit: "DET",
  Indiana: "IND",
  Miami: "MIA",
  Milwaukee: "MIL",
  "New York": "NYK",
  Orlando: "ORL",
  Philadelphia: "PHI",
  Toronto: "TOR",
  Washington: "WAS",
  Dallas: "DAL",
  Denver: "DEN",
  "Golden State": "GSW",
  Houston: "HOU",
  "LA Clippers": "LAC",
  "LA Lakers": "LAL",
  Memphis: "MEM",
  Minnesota: "MIN",
  "New Orleans": "NOP",
  "Oklahoma City": "OKC",
  Phoenix: "PHX",
  Portland: "POR",
  Sacramento: "SAC",
  "San Antonio": "SAS",
  Utah: "UTA",
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
    // Filled in from what the teams have released: allEvents in lib/fairseat/events.ts.
    seats: [],
    teamWallets: true,
    ringPrices: [900, 420],
  },
];

/** The sections of an open arena and the side each is on: the first half of a ring is the first side's. */
export const openSections = (event: FairEvent) =>
  event.map.rings.flatMap((ring, index) =>
    Array.from({ length: ring.count }, (_, at) => ({
      section: String(ring.first + at),
      side: event.sides[at < ring.count / 2 ? 0 : 1].id,
      faceValue: event.ringPrices?.[index] ?? 0,
    })),
  );

/** A seat in an open arena, worked out from its id, or null if the arena has no such seat. */
export function openSeat(event: FairEvent, seatId: string): Seat | null {
  if (!event.ringPrices) return null;
  const [section, row, seat] = seatId.split("-");
  const found = openSections(event).find((item) => item.section === section);
  const inRange = (value: string, most: number) =>
    /^[1-9]\d*$/.test(value) && Number(value) <= most;
  if (!found || !inRange(row, SECTION.rows) || !inRange(seat, SECTION.seats))
    return null;
  return { id: seatId, row, seat, ...found };
}

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
{ label: string; sport: Sport; side: string; map: VenueMap }
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
};

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
