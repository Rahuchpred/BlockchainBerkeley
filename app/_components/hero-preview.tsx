"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/lime/ui/button";
import { Status } from "@/components/lime/ui/status";
import { formatAmount } from "@/components/lime/ui/amount";
import { percent, type VenueMap } from "@/lib/fairseat/data";
import { OwnershipBar, type Share } from "./ownership-bar";
import { StadiumMap, type SectionInfo } from "./stadium-map";
import { TeamMark } from "./team-mark";

export type PreviewSection = {
  /** The side of the stadium the section is on. */
  side: string;
  /** The full price of a seat in the section. */
  faceValue: number;
  /** Where its first seat's tickets are sold. */
  href: string;
};

export type PreviewTeam = Share & { image: string | null };

/** How many teams the preview lists. The rest are one press away. */
const SHOWN = 5;

// The product itself, live, as the home page's picture: press a section and see the same seat priced
// once per team.
export function HeroPreview({
  title,
  eventHref,
  map,
  info,
  sections,
  teams,
  split,
}: {
  title: string;
  eventHref: string;
  map: VenueMap;
  info: Record<string, SectionInfo>;
  sections: Record<string, PreviewSection>;
  /** Each side's teams, likeliest first. */
  teams: Record<string, PreviewTeam[]>;
  split: boolean;
}) {
  const first = Object.keys(sections)[0];
  const [chosen, setChosen] = useState<string | null>(first ?? null);
  const section = chosen ? sections[chosen] : undefined;
  const side = section ? (teams[section.side] ?? []) : [];

  return (
    <div className="grid gap-4 rounded-panel border border-line bg-surface p-3 text-start sm:p-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <StadiumMap
          map={map}
          sections={info}
          selected={chosen}
          onSelect={(next) => setChosen(next ?? chosen)}
          split={split}
          label={`Seating map for ${title}`}
        />
        <div className="px-2 pb-1">
          <Status status="done" label="Live prices from Gemini" />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-panel bg-raised p-4 lg:col-span-2">
        <div className="flex flex-col gap-1">
          <p className="text-base leading-snug font-semibold">
            {chosen ? `One seat in section ${chosen}` : title}
          </p>
          {section && (
            <p className="text-sm text-fg-2">
              {`Full price ${formatAmount(section.faceValue)}, split by the odds`}
            </p>
          )}
        </div>
        <OwnershipBar shares={side} legend={0} />
        <ul className="flex flex-col gap-3">
          {side.slice(0, SHOWN).map((team) => (
            <li key={team.team} className="flex items-center gap-3">
              <TeamMark image={team.image} team={team.team} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {team.team}
                </span>
                <span className="text-sm text-fg-3">
                  {percent(team.share)} of the seat
                </span>
              </span>
              <span className="font-mono text-base tabular-nums">
                {section
                  ? formatAmount(
                      Math.round(section.faceValue * team.share * 100) / 100,
                    )
                  : ""}
              </span>
            </li>
          ))}
        </ul>
        {side.length > SHOWN && (
          <p className="text-sm text-fg-2">{`and ${side.length - SHOWN} more teams`}</p>
        )}
        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={<Link href={section?.href ?? eventHref} />}
        >
          See every team for this seat
        </Button>
      </div>
    </div>
  );
}
