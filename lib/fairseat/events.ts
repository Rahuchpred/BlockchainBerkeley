import { EVENTS, openSeat, type FairEvent, type Seat } from "./data";
import { listedEvents, releasedTickets } from "./store";

/** An open arena's seats are the ones some team has released a ticket for, in seating order. */
function withReleasedSeats(event: FairEvent): FairEvent {
  if (!event.ringPrices) return event;
  const ids = new Set(
    releasedTickets()
      .filter((ticket) => ticket.eventId === event.id)
      .map((ticket) => ticket.seatId),
  );
  const seats = [...ids]
    .map((id) => openSeat(event, id))
    .filter((seat): seat is Seat => seat !== null)
    .sort(
      (a, b) =>
        Number(a.section) - Number(b.section) ||
        Number(a.row) - Number(b.row) ||
        Number(a.seat) - Number(b.seat),
    );
  return { ...event, seats };
}

// Every event on sale: the ones Fairseat ships with, then the ones organizers have listed.
export const allEvents = (): FairEvent[] =>
  [...EVENTS, ...listedEvents()].map(withReleasedSeats);

export const findEvent = (id: string) =>
  allEvents().find((event) => event.id === id);
