import Link from "next/link";
import { cn } from "@/lib/lime/utils";
import { SECTION } from "@/lib/fairseat/data";

export type GridSeat = {
  row: string;
  seat: string;
  href: string;
  label: string;
  /** How many of this seat's team tickets are sold, and how many teams it has. */
  sold: number;
  teams: number;
  /** This wallet holds a ticket for the seat. */
  mine: boolean;
};

const KEY = [
  { label: "On sale", mark: "bg-accent" },
  { label: "Some teams sold", mark: "bg-warn" },
  { label: "Yours", mark: "bg-success" },
  { label: "Not on Fairseat", mark: "bg-surface-3" },
];

// One section seen from above: every row and seat, with the ones Fairseat sells marked.
export function SectionSeats({
  section,
  seats,
}: {
  section: string;
  seats: GridSeat[];
}) {
  const find = (row: number, seat: number) =>
    seats.find(
      (item) => item.row === String(row) && item.seat === String(seat),
    );

  return (
    <div className="flex flex-col gap-3 rounded-panel bg-surface p-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {KEY.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2 text-sm text-fg-2"
          >
            <span
              aria-hidden="true"
              className={cn("size-3 shrink-0 rounded-sm", item.mark)}
            />
            {item.label}
          </li>
        ))}
      </ul>
      <div
        role="group"
        aria-label={`Seats in section ${section}`}
        className="flex flex-col gap-1"
      >
        {Array.from({ length: SECTION.rows }, (_, rowIndex) => {
          const row = rowIndex + 1;
          return (
            <div key={row} className="flex items-center gap-1">
              <span className="w-5 shrink-0 text-xs text-fg-3 tabular-nums">
                {row}
              </span>
              {Array.from({ length: SECTION.seats }, (_, seatIndex) => {
                const seat = find(row, seatIndex + 1);
                if (!seat) {
                  return (
                    <span
                      key={seatIndex}
                      aria-hidden="true"
                      className="aspect-square min-w-0 flex-1 rounded-sm bg-surface-3"
                    />
                  );
                }
                return (
                  <Link
                    key={seatIndex}
                    href={seat.href}
                    aria-label={`${seat.label}, ${seat.sold} of ${seat.teams} team tickets sold${seat.mine ? ", you hold one" : ""}`}
                    className={cn(
                      "aspect-square min-w-0 flex-1 rounded-sm transition-transform duration-(--dur-instant) ease-out active:scale-(--scale-press)",
                      seat.mine
                        ? "bg-success"
                        : seat.sold > 0
                          ? "bg-warn"
                          : "bg-accent hover:bg-accent-hover",
                    )}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-fg-2">
        Row 1 is closest to the field. Press a marked seat to see its tickets.
      </p>
    </div>
  );
}
