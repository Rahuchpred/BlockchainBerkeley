"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/lime/ui/button";
import { formatAmount } from "@/components/lime/ui/amount";
import { cn } from "@/lib/lime/utils";
import { SECTION, type VenueMap } from "@/lib/fairseat/data";
import { releaseSeats } from "../actions";
import { StadiumMap, type SectionInfo } from "./stadium-map";

/** The most seats one release mints, so the wait on the ledger stays short. */
const LIMIT = 32;

const KEY = [
  { label: "Released", mark: "bg-success" },
  { label: "Picked", mark: "bg-accent" },
  { label: "Not released", mark: "bg-surface-3" },
];

// A seat is one small square in a grid of 160, which no Lime control is, and a picked one takes the
// accent as the seats on sale do on the buyer's map.
/* eslint-disable lime/no-native-control, lime/lime-scarce */
function SeatButton({
  label,
  state,
  disabled,
  onClick,
}: {
  label: string;
  state: "released" | "picked" | "free";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={state === "picked"}
      aria-label={state === "released" ? `${label}, released` : label}
      disabled={disabled || state === "released"}
      onClick={onClick}
      className={cn(
        "aspect-square min-w-0 flex-1 rounded-sm transition-colors duration-(--dur-instant)",
        state === "released"
          ? "cursor-not-allowed bg-success"
          : state === "picked"
            ? "cursor-pointer bg-accent hover:bg-accent-hover"
            : "cursor-pointer bg-surface-3 hover:bg-line-strong",
      )}
    />
  );
}
/* eslint-enable lime/no-native-control, lime/lime-scarce */

// The team's side of the arena, seat by seat. The organizer picks a section on the map, then any of
// its seats, and releases the team's ticket for each. Releasing mints them on the ledger from the
// team's own wallet, so the button stays busy until the ledger has confirmed it.
export function ReleaseChart({
  eventId,
  team,
  map,
  sections,
  released,
  ready,
}: {
  eventId: string;
  team: string;
  map: VenueMap;
  /** The sections on this team's side, with what the team's ticket for a seat there costs now. */
  sections: Record<string, { price: number; faceValue: number }>;
  /** The seats this team has already released its ticket for. */
  released: string[];
  /** The team's organizer wallet already exists on the ledger. */
  ready: boolean;
}) {
  const [section, setSection] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = new Set(released);

  const marks: Record<string, SectionInfo> = Object.fromEntries(
    Object.keys(sections).map((id) => [id, { from: null, seats: 0 }]),
  );
  const info = section ? sections[section] : null;
  const free = (row: number) =>
    Array.from(
      { length: SECTION.seats },
      (_, index) => `${section}-${row}-${index + 1}`,
    ).filter((id) => !done.has(id));
  const toggle = (ids: string[]) => {
    const all = ids.every((id) => picked.includes(id));
    setPicked(
      all
        ? picked.filter((id) => !ids.includes(id))
        : [...new Set([...picked, ...ids])].slice(0, LIMIT),
    );
  };

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <div className="rounded-panel bg-surface p-3 lg:col-span-3">
        <StadiumMap
          plain
          map={map}
          sections={marks}
          selected={section}
          onSelect={setSection}
          label={`The ${team} side of the arena`}
        />
        <p className="px-2 pb-1 text-sm text-fg-2">
          Blue sections are on the {team} side. Press one to see its seats.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:col-span-2">
        {section && info ? (
          <>
            <h3 className="text-lg leading-tight font-semibold">{`Section ${section}`}</h3>
            <p className="text-sm leading-normal text-fg-2">
              {`A seat here is ${formatAmount(info.faceValue)} in full. The ${team} ticket for it is ${formatAmount(info.price)} now.`}
            </p>
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
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="w-6"
                      aria-label={`Pick every seat in row ${row}`}
                      disabled={pending || free(row).length === 0}
                      onClick={() => toggle(free(row))}
                    >
                      {row}
                    </Button>
                    {Array.from({ length: SECTION.seats }, (_, seatIndex) => {
                      const id = `${section}-${row}-${seatIndex + 1}`;
                      const on = picked.includes(id);
                      return (
                        <SeatButton
                          key={id}
                          label={`Row ${row}, seat ${seatIndex + 1}`}
                          state={
                            done.has(id) ? "released" : on ? "picked" : "free"
                          }
                          disabled={pending}
                          onClick={() => toggle([id])}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-fg-2">
              {`Row 1 is closest to the court. Press a seat, or a row's number for the whole row. Up to ${LIMIT} seats at a time.`}
            </p>
          </>
        ) : (
          <p className="text-sm leading-normal text-fg-2">
            Pick a section on the map to choose seats in it.
          </p>
        )}

        <div>
          <Button
            pending={pending}
            disabled={picked.length === 0}
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await releaseSeats(eventId, picked);
                if (result?.error) setError(result.error);
                else setPicked([]);
              })
            }
          >
            {picked.length === 0
              ? "Release tickets"
              : `Release ${picked.length} ${picked.length === 1 ? "ticket" : "tickets"}`}
          </Button>
        </div>
        {pending && (
          <p className="text-sm leading-normal text-fg-2">
            {ready
              ? "Minting the tickets on the XRP Ledger. This takes up to 30 seconds."
              : `Opening the ${team} wallet on the XRP Ledger, then minting the tickets. This takes up to a minute.`}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm leading-normal text-danger-text">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
