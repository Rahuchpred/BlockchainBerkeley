"use client";

import { useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/lime/ui/card";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";
import { formatAmount } from "@/components/lime/ui/amount";
import { OwnershipBar, type Share } from "./ownership-bar";
import { TeamMark } from "./team-mark";

export type EventSummary = {
  id: string;
  title: string;
  sport: string;
  date: string;
  place: string;
  teams: { team: string; image: string | null }[];
  shares: Share[];
  from: number | null;
  /** What decides the seat, when it is not a place in the event's own final. */
  note?: string;
};

const SPORTS = ["All", "Football", "Baseball", "Soccer"];

export function EventBrowser({ events }: { events: EventSummary[] }) {
  const [sport, setSport] = useState("All");
  const shown =
    sport === "All" ? events : events.filter((event) => event.sport === sport);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={sport} onValueChange={setSport} aria-label="Sport">
          {SPORTS.map((name) => (
            <SegmentedItem key={name} value={name}>
              {name}
            </SegmentedItem>
          ))}
        </Segmented>
        <p className="text-sm text-fg-2 tabular-nums">
          {shown.length} {shown.length === 1 ? "event" : "events"}
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((event) => (
          <li key={event.id} className="flex">
            <Card
              interactive
              href={`/events/${event.id}`}
              variant="surface"
              className="w-full"
            >
              <div className="flex items-center gap-2">
                {event.teams.map((item) => (
                  <TeamMark
                    key={item.team}
                    team={item.team}
                    image={item.image}
                    size="md"
                  />
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <CardTitle>{event.title}</CardTitle>
                <CardDescription>{event.date}</CardDescription>
                <CardDescription>{event.place}</CardDescription>
                {event.note && <CardDescription>{event.note}</CardDescription>}
              </div>
              {event.shares.length > 0 && (
                <OwnershipBar shares={event.shares} legend={2} />
              )}
              <p className="text-sm text-fg-2">
                {event.from === null
                  ? "Finalists decided"
                  : `From ${formatAmount(event.from)}`}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
