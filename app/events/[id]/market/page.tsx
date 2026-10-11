import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/lime/ui/badge";
import { Button } from "@/components/lime/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/lime/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/lime/ui/table";
import { formatAmount } from "@/components/lime/ui/amount";
import { Icon, ArrowLeft } from "@/components/lime/icon";
import { percent, seatLabel } from "@/lib/fairseat/data";
import { findEvent } from "@/lib/fairseat/events";
import { getHistory } from "@/lib/fairseat/gemini";
import { loadSides } from "@/lib/fairseat/live";
import { allActivity } from "@/lib/fairseat/store";
import { describe, formatTime } from "@/lib/fairseat/story";
import { RESALE_RATE, txUrl } from "@/lib/fairseat/xrpl";
import { MarketChart } from "../../../_components/market-chart";
import { PageSkeleton } from "../../../_components/page-skeleton";
import { TeamMark } from "../../../_components/team-mark";

/** How many teams get a line on the chart. More than this is unreadable. */
const LINES = 6;
const MOVERS = 3;

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

async function MarketContent({
  params,
}: Pick<PageProps<"/events/[id]/market">, "params">) {
  const { id } = await params;
  const event = findEvent(id);
  if (!event) notFound();

  const sides = await Promise.all(
    (await loadSides(event)).map(async (side) => {
      const cheapest = Math.min(
        ...event.seats
          .filter((seat) => seat.side === side.id)
          .map((seat) => seat.faceValue),
      );
      const teams = await Promise.all(
        side.onSale.map(async (outcome) => {
          const days = await getHistory(outcome.symbol, "1day");
          const last = days[days.length - 1];
          const before = days[days.length - 2];
          return {
            ...outcome,
            change: last && before ? last.v - before.v : 0,
            trend: days.slice(-30),
            from: Math.round(cheapest * outcome.share * 100) / 100,
          };
        }),
      );
      return { ...side, teams };
    }),
  );
  const movers = sides
    .flatMap((side) => side.teams)
    .filter((team) => team.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, MOVERS);
  const sales = allActivity()
    .filter(
      (step) =>
        step.eventId === event.id &&
        (step.kind === "bought" || step.kind === "resold"),
    )
    .reverse()
    .slice(0, 8);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <header className="flex items-start gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to the event"
          nativeButton={false}
          render={<Link href={`/events/${event.id}`} />}
          icon={<Icon icon={ArrowLeft} size={20} />}
        />
        <div className="flex flex-col gap-1">
          <h1 className="title-page">{`${event.title} market`}</h1>
          <p className="max-w-xl text-base leading-normal text-fg-2">
            Each team&apos;s chance of making the final, from Gemini&apos;s
            prediction market. These chances set every ticket price.
          </p>
        </div>
      </header>

      {movers.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Biggest movers today</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {movers.map((team) => (
              <li key={team.symbol} className="flex">
                <Card variant="surface" className="w-full">
                  <div className="flex items-center justify-between gap-3">
                    <TeamMark image={team.image} team={team.team} size="md" />
                    <Change points={team.change} />
                  </div>
                  <CardTitle>{team.team}</CardTitle>
                  <CardDescription>
                    {`${percent(team.chance)} chance, tickets from ${formatAmount(team.from)}`}
                  </CardDescription>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sides.map((side) => (
        <section key={side.id} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{side.name}</h2>
          {side.settled ? (
            <p className="text-base leading-normal text-fg-2">
              {side.settled} made the final. This side has settled.
            </p>
          ) : (
            <>
              <div className="rounded-panel bg-surface p-4">
                <MarketChart
                  label={`Chances for the ${side.name} over the last month`}
                  lines={side.teams.slice(0, LINES).map((team) => ({
                    team: team.team,
                    tone: team.tone,
                    points: team.trend,
                  }))}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-end">Chance</TableHead>
                    <TableHead>Today</TableHead>
                    <TableHead className="text-end">Tickets from</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {side.teams.map((team) => (
                    <TableRow key={team.symbol}>
                      <TableCell>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full bg-(--tone)"
                            style={
                              {
                                "--tone": `var(--team-${team.tone})`,
                              } as React.CSSProperties
                            }
                          />
                          {team.team}
                        </span>
                      </TableCell>
                      <TableCell className="text-end font-mono tabular-nums">
                        {percent(team.chance)}
                      </TableCell>
                      <TableCell>
                        <Change points={team.change} />
                      </TableCell>
                      <TableCell className="text-end font-mono tabular-nums">
                        {formatAmount(team.from)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent sales</h2>
        {sales.length === 0 ? (
          <p className="text-sm leading-normal text-fg-2">
            No tickets have changed hands for this event yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Seat</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Proof</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((step) => {
                const seat = event.seats.find(
                  (item) => item.id === step.seatId,
                );
                return (
                  <TableRow key={`${step.at}-${step.nftId}`}>
                    <TableCell className="whitespace-nowrap">
                      {describe(step, RESALE_RATE).title}
                    </TableCell>
                    <TableCell className="whitespace-nowrap capitalize">
                      {step.team.replaceAll("-", " ")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-fg-2">
                      {seat ? seatLabel(seat) : step.seatId}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-fg-2">
                      {formatTime(step.at)}
                    </TableCell>
                    <TableCell>
                      {step.hash && (
                        <Button
                          variant="link"
                          size="sm"
                          nativeButton={false}
                          render={
                            <a
                              href={txUrl(step.hash)}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          Transaction
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  );
}

export default function MarketPage({
  params,
}: PageProps<"/events/[id]/market">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketContent params={params} />
    </Suspense>
  );
}
