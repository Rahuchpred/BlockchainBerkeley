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

export type Sport = "Football" | "Baseball";

/** The shape of a venue's seating bowl: rings of numbered sections around the field, inner ring first. */
export type VenueMap = {
  field: "football" | "baseball";
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

/** Three seats in one section, all at the same full price. */
export const seats = (
  side: string,
  section: string,
  faceValue: number,
): Seat[] =>
  [
    ["3", "12"],
    ["3", "13"],
    ["8", "4"],
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
];

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
