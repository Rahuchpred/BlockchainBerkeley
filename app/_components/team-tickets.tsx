"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/lime/ui/badge";
import { Button } from "@/components/lime/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/lime/ui/card";
import { Radio, RadioGroup } from "@/components/lime/ui/radio";
import { Status } from "@/components/lime/ui/status";
import { formatAmount } from "@/components/lime/ui/amount";
import { cn } from "@/lib/lime/utils";
import { FEE_RATE, type Condition } from "@/lib/fairseat/data";
import { LiveValue } from "./live";
import { OddsChart, type ChartPoint } from "./odds-chart";
import { OwnershipBar } from "./ownership-bar";
import { TeamMark } from "./team-mark";

export type TeamTicket = {
  slug: string;
  team: string;
  image: string | null;
  tone: number;
  /** The team's share of the seat when the page was rendered. */
  share: number;
  /** Percentage points since yesterday. */
  change: number;
  /** Daily closes, oldest first, in percent. */
  trend: ChartPoint[];
  /** Another fan already holds this team's ticket for this seat. */
  sold: boolean;
  /** The price its holder is reselling it for, if they have listed it. */
  resale: number | null;
  /** Where teams sell their own tickets: this team's organizer has not released this one yet. */
  unreleased?: boolean;
};

/** How many teams show before the rest are folded away. */
const SHOWN = 6;
const REFRESH_MS = 15_000;

const cents = (value: number) => Math.round(value * 100) / 100;

function Change({ points }: { points: number }) {
  if (points === 0) return <Badge variant="neutral">No change</Badge>;
  const up = points > 0;
  const size = Math.abs(points);
  return (
    <Badge
      variant={up ? "success" : "danger"}
    >{`${up ? "Up" : "Down"} ${size} ${size === 1 ? "pt" : "pts"}`}</Badge>
  );
}

export function TeamTickets({
  market,
  buyBase,
  faceValue,
  condition,
  teams,
}: {
  market: string;
  buyBase: string;
  faceValue: number;
  /** What a team must do for its ticket to become the seat. */
  condition: Condition;
  teams: TeamTicket[];
}) {
  const firstOpen =
    teams.find((team) => !team.sold && !team.unreleased) ?? teams[0];
  /** A sold ticket can only be picked while its holder has it listed, and an unreleased one not at all. */
  const gone = (team: TeamTicket) =>
    Boolean(team.unreleased) || (team.sold && team.resale === null);
  const [chosen, setChosen] = useState(firstOpen.slug);
  const [expanded, setExpanded] = useState(false);
  const [shares, setShares] = useState<Record<string, number>>({});
  const [updated, setUpdated] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/markets/${market}`);
        if (!response.ok || !alive) return;
        const body = (await response.json()) as {
          shares: Record<string, number>;
        };
        // Each price that moved rolls to its new figure and is tinted for a moment. See LiveValue.
        setShares(body.shares);
        setUpdated(new Date().toLocaleTimeString());
      } catch {
        // Keep the last prices. The next refresh tries again.
      }
    };
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [market]);

  const live = teams.map((team) => ({
    ...team,
    share: shares[team.slug] ?? team.share,
  }));
  const picked = live.find((team) => team.slug === chosen) ?? live[0];
  const rows = expanded
    ? live
    : live.filter((team, index) => index < SHOWN || team.slug === chosen);
  const hidden = live.length - rows.length;
  // A resale costs what its holder asks. Fairseat's fee was paid on the first sale.
  const price = picked.resale ?? cents(faceValue * picked.share);
  const fee = picked.resale === null ? cents(price * FEE_RATE) : 0;
  const total = cents(price + fee);
  const review = `${buyBase}/${picked.slug}`;

  return (
    <div className="grid gap-8 pb-24 lg:grid-cols-3 lg:pb-0">
      <div className="flex flex-col gap-8 lg:col-span-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Who holds this seat</h2>
          <OwnershipBar shares={live} />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Pick your team</h2>
          <p className="max-w-xl text-sm leading-normal text-fg-2">
            The seat&apos;s full price is {formatAmount(faceValue)}, split
            between the teams by their odds. Your ticket becomes the seat if
            your team {condition.makes}.
          </p>
          <div className="overflow-hidden rounded-panel bg-surface">
            <RadioGroup
              value={chosen}
              onValueChange={(value) => setChosen(value as string)}
              aria-label="Team"
              className="gap-0"
            >
              {rows.map((team, index) => (
                <label
                  key={team.slug}
                  // Rows revealed by "Show more" fade in one after another. The first six are there from the start.
                  style={
                    {
                      "--delay": `${Math.max(0, index - SHOWN) * 30}ms`,
                    } as React.CSSProperties
                  }
                  className={cn(
                    "flex min-h-14 items-center gap-3 border-b border-line p-4 last:border-b-0",
                    "transition-opacity delay-(--delay) duration-(--dur-fast) ease-out motion-reduce:delay-0",
                    index >= SHOWN && "starting:opacity-0",
                    gone(team) ? "cursor-not-allowed" : "cursor-pointer",
                    team.slug === chosen
                      ? "bg-accent-wash"
                      : !gone(team) && "hover:bg-surface-2",
                  )}
                >
                  <Radio value={team.slug} disabled={gone(team)} />
                  <TeamMark image={team.image} team={team.team} size="md" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "flex items-center gap-2 text-base leading-snug font-medium",
                        gone(team) && "text-fg-3",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full bg-(--tone)"
                        style={
                          {
                            "--tone": `var(--team-${team.tone})`,
                          } as React.CSSProperties
                        }
                      />
                      <span className="min-w-0">{team.team}</span>
                    </span>
                    <span className="truncate text-sm text-fg-3">
                      <LiveValue kind="percent" value={team.share} /> of the
                      seat
                    </span>
                  </span>
                  {team.resale !== null ? (
                    <Badge variant="warn">Resale</Badge>
                  ) : team.sold ? (
                    <Badge variant="outline">Sold</Badge>
                  ) : team.unreleased ? (
                    <Badge variant="outline">Not released</Badge>
                  ) : (
                    <span className="hidden sm:inline-flex">
                      <Change points={team.change} />
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-base font-medium tabular-nums",
                      gone(team) ? "text-fg-3" : "text-fg",
                    )}
                  >
                    <LiveValue
                      value={team.resale ?? cents(faceValue * team.share)}
                      label={`${team.team} ticket`}
                    />
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {hidden > 0 || expanded ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Show fewer teams" : `Show ${hidden} more teams`}
              </Button>
            ) : (
              <span />
            )}
            <Status
              status="done"
              label={
                updated
                  ? `Live from Gemini, updated ${updated}`
                  : "Live from Gemini"
              }
            />
          </div>
        </section>
      </div>

      <aside className="lg:col-span-1">
        <Card variant="outline" className="lg:sticky lg:top-20">
          <div className="flex items-center gap-3">
            <TeamMark image={picked.image} team={picked.team} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>{picked.team}</CardTitle>
              <CardDescription>
                Yours if {picked.team} {condition.make}.
              </CardDescription>
            </div>
          </div>
          <OddsChart
            tone={picked.tone}
            label={`${picked.team}'s chance over the last month`}
            ranges={[{ label: "1M", points: picked.trend }]}
          />
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-2">Ticket</dt>
              <dd className="tabular-nums">
                <LiveValue key={picked.slug} value={price} />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-2">Fee</dt>
              <dd className="tabular-nums">
                <LiveValue key={picked.slug} value={fee} />
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-2 font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">
                <LiveValue key={picked.slug} value={total} />
              </dd>
            </div>
          </dl>
          {/* On a phone the action lives in the bar pinned to the bottom, so it is always in reach. */}
          <Button
            size="lg"
            className="hidden w-full lg:inline-flex"
            disabled={gone(picked)}
            nativeButton={false}
            render={<Link href={review} />}
          >
            Review purchase
          </Button>
        </Card>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-page px-4 pt-3 pb-4 lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm text-fg-2">{picked.team}</span>
            <span className="text-base font-medium tabular-nums">
              <LiveValue key={picked.slug} value={total} />
            </span>
          </div>
          {/* eslint-disable-next-line lime/one-primary -- the same action as the panel button, which is hidden at this width */}
          <Button
            size="lg"
            disabled={gone(picked)}
            nativeButton={false}
            render={<Link href={review} />}
          >
            Review purchase
          </Button>
        </div>
      </div>
    </div>
  );
}
