"use client";

import { useState } from "react";
import { Button } from "@/components/lime/ui/button";
import { List, ListItem } from "@/components/lime/ui/list";
import { Status } from "@/components/lime/ui/status";
import { formatAmount } from "@/components/lime/ui/amount";
import type { VenueMap } from "@/lib/fairseat/data";
import { OwnershipBar, type Share } from "./ownership-bar";
import { StadiumMap, type SectionInfo } from "./stadium-map";

export type FinderSide = { id: string; name: string; shares: Share[] };
export type FinderSeat = {
  id: string;
  side: string;
  section: string;
  label: string;
  summary: string;
  faceValue: number;
  href: string;
};

// The event's seats two ways: the bowl to pick a section from, and the seats in it to open.
export function SeatFinder({
  title,
  map,
  sides,
  seats,
  sections,
}: {
  title: string;
  map: VenueMap;
  sides: FinderSide[];
  seats: FinderSeat[];
  sections: Record<string, SectionInfo>;
}) {
  const [section, setSection] = useState<string | null>(null);
  const shown = section
    ? seats.filter((seat) => seat.section === section)
    : seats;

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <section className="flex flex-col gap-3 lg:order-last lg:col-span-3">
        <h2 className="text-lg font-semibold">Pick a section</h2>
        <div className="rounded-panel bg-surface p-3 lg:sticky lg:top-20">
          <div className="flex justify-between gap-3 px-2 pt-1 text-sm text-fg-2">
            <span>{sides[1]?.name}</span>
            <span>{sides[0]?.name}</span>
          </div>
          <StadiumMap
            map={map}
            sections={sections}
            selected={section}
            onSelect={setSection}
            label={`Seating map for ${title}`}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
            <Status status="done" label="Live prices from Gemini" />
            <p className="text-sm text-fg-2">
              Blue sections have tickets on sale.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-8 lg:col-span-2">
        {section && (
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Section {section}</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSection(null)}
            >
              Show all sections
            </Button>
          </div>
        )}
        {sides.map((side) => {
          const rows = shown.filter((seat) => seat.side === side.id);
          if (rows.length === 0) return null;
          return (
            <section key={side.id} className="flex flex-col gap-3">
              {section ? (
                <p className="text-sm text-fg-2">{side.name}</p>
              ) : (
                <h2 className="text-lg font-semibold">{side.name}</h2>
              )}
              {side.shares.length > 0 && (
                <OwnershipBar shares={side.shares} legend={3} />
              )}
              <List variant="grouped">
                {rows.map((seat) => (
                  <ListItem
                    key={seat.id}
                    href={seat.href}
                    title={seat.label}
                    description={seat.summary}
                    trailing={formatAmount(seat.faceValue, { compact: true })}
                  />
                ))}
              </List>
            </section>
          );
        })}
      </div>
    </div>
  );
}
