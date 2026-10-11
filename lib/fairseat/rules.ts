// The rules that keep a sale fair, and the numbers behind them. Every one is checked on the server.

/** The most tickets one wallet may hold for the same team in one event. */
export const TICKET_LIMIT = 4;

/** A resale may ask at most this many times what the ticket would cost new right now. */
export const RESALE_CAP = 1.5;

/** The highest price a ticket can be listed for, given what it would cost new right now. */
export const resaleCap = (worth: number) =>
  Math.round(worth * RESALE_CAP * 100) / 100;

/** How long after the event a fan must wait before taking back a payment that was never released. */
export const REFUND_DAYS = 30;

/** Demo only: how soon a new purchase can be refunded while the demo switch is on. */
export const DEMO_REFUND_MINUTES = 2;

/** When a payment for an event on this date can be taken back, if it was never released. */
export function refundDeadline(eventDate: string) {
  const after = new Date(`${eventDate}T12:00:00Z`);
  after.setUTCDate(after.getUTCDate() + REFUND_DAYS);
  return after;
}

/**
 * When one locked payment can be taken back. A payment made while the demo switch was on carries
 * its own short deadline. Every other one follows the event's date.
 */
export const refundAfterFor = (
  escrow: { refundAfter?: string },
  eventDate: string,
) =>
  escrow.refundAfter ? new Date(escrow.refundAfter) : refundDeadline(eventDate);

const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const minuteFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** A refund deadline as a plain date. One less than a day away also says the time. */
export const formatDeadline = (after: Date, now: Date) =>
  (after.getTime() - now.getTime() < 86_400_000
    ? minuteFormat
    : dayFormat
  ).format(after);
