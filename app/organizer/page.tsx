import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge } from "@/components/lime/ui/badge";
import { Button } from "@/components/lime/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/lime/ui/card";
import { Progress } from "@/components/lime/ui/progress";
import { formatAmount } from "@/components/lime/ui/amount";
import { formatDate } from "@/lib/fairseat/data";
import { allEvents } from "@/lib/fairseat/events";
import { loadSides } from "@/lib/fairseat/live";
import { allActivity, pendingEscrows, soldTickets } from "@/lib/fairseat/store";
import { shortAddress } from "@/lib/fairseat/story";
import {
  RESALE_RATE,
  accountUrl,
  getBalance,
  organizerAddress,
} from "@/lib/fairseat/xrpl";
import { PageSkeleton } from "../_components/page-skeleton";
import { Stat } from "../_components/stat";
import { TeamMark } from "../_components/team-mark";

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

/** One part of the money bar: where a share of what fans paid sits right now. */
function MoneyBar({
  parts,
}: {
  parts: { label: string; amount: number; fill: string }[];
}) {
  const total = sum(parts.map((part) => part.amount));
  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={parts
          .map((part) => `${part.label} ${formatAmount(part.amount)}`)
          .join(", ")}
        className="flex h-4 gap-1 overflow-hidden rounded-full bg-surface-3"
      >
        {parts.map(
          (part) =>
            part.amount > 0 && (
              <span
                key={part.label}
                className={`${part.fill} w-(--pct) transition-[width] duration-(--dur-slow) ease-out`}
                style={
                  {
                    "--pct": `${(part.amount / total) * 100}%`,
                  } as React.CSSProperties
                }
              />
            ),
        )}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${part.fill}`}
            />
            <span className="text-fg-2">{part.label}</span>
            <span className="font-mono tabular-nums">
              {formatAmount(part.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Dashboard() {
  await connection();
  const sold = soldTickets();
  const escrows = pendingEscrows();
  const activity = allActivity();
  const account = organizerAddress();
  const balance = await getBalance(account).catch(() => Number.NaN);

  const released = activity.filter((step) => step.kind === "released");
  const resales = activity.filter((step) => step.kind === "resold");
  const amounts = (steps: typeof activity) =>
    steps.map((step) => step.amount ?? 0);

  const rows = await Promise.all(
    allEvents().map(async (event) => {
      const tickets = sold.filter((ticket) => ticket.eventId === event.id);
      const of = (steps: typeof activity) =>
        steps.filter((step) => step.eventId === event.id);
      const outcomes = (await loadSides(event)).flatMap(
        (side) => side.outcomes,
      );
      // How many tickets each team has sold for this event, most first.
      const counts = new Map<string, number>();
      for (const ticket of tickets)
        counts.set(ticket.team, (counts.get(ticket.team) ?? 0) + 1);
      const teams = [...counts.entries()]
        .map(([team, n]) => {
          const outcome = outcomes.find((item) => item.slug === team);
          return {
            slug: team,
            name: outcome?.team ?? team.replaceAll("-", " "),
            image: outcome?.image ?? null,
            tone: outcome?.tone ?? 0,
            n,
          };
        })
        .sort((a, b) => b.n - a.n);
      return {
        event,
        tickets: tickets.length,
        // Every seat has one ticket for each team on its side.
        capacity: event.seats.length * (outcomes.length / event.sides.length),
        held: sum(tickets.map((ticket) => escrows[ticket.nftId]?.amount ?? 0)),
        released: sum(amounts(of(released))),
        resale: sum(amounts(of(resales))) * RESALE_RATE,
        teams,
      };
    }),
  );
  const held = sum(rows.map((row) => row.held));
  const paidOut = sum(rows.map((row) => row.released));
  const resale = sum(rows.map((row) => row.resale));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="title-page">Organizer</h1>
          <p className="max-w-xl text-base leading-normal text-fg-2">
            What your events have sold, and where the money is on the ledger.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/organizer/new" />}>
          List an event
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Tickets sold" value={String(sold.length)} />
        <Stat label="Held in escrow" value={formatAmount(held)} />
        <Stat label="Released to you" value={formatAmount(paidOut)} />
        <Stat label="From resales" value={formatAmount(resale)} />
      </div>

      <section className="flex flex-col gap-4 rounded-panel bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Where the money is</h2>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-fg-2">
              {shortAddress(account)} holds{" "}
              {Number.isFinite(balance)
                ? formatAmount(balance)
                : "an unknown amount"}
            </p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a
                  href={accountUrl(account)}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              View on the ledger
            </Button>
          </div>
        </div>
        <MoneyBar
          parts={[
            { label: "Held in escrow", amount: held, fill: "bg-warn" },
            { label: "Released to you", amount: paidOut, fill: "bg-success" },
            { label: "From resales", amount: resale, fill: "bg-ink" },
          ]}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Events</h2>
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => {
            const most = Math.max(1, ...row.teams.map((team) => team.n));
            return (
              <li key={row.event.id} className="flex">
                <Card
                  interactive
                  href={`/events/${row.event.id}`}
                  variant="outline"
                  className="w-full"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle>{row.event.title}</CardTitle>
                      <CardDescription>
                        {formatDate(row.event.date)}
                      </CardDescription>
                    </div>
                    {row.event.checkedAgainst ? (
                      <Badge variant="success">Checked</Badge>
                    ) : (
                      <Badge variant="neutral">By Fairseat</Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-fg-2">Tickets sold</span>
                      <span className="font-mono tabular-nums">{`${row.tickets} of ${row.capacity}`}</span>
                    </div>
                    <Progress
                      value={row.tickets}
                      max={row.capacity}
                      label={`Tickets sold for ${row.event.title}`}
                      valueText={`${row.tickets} of ${row.capacity}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-fg-2">In escrow</span>
                      <span className="font-mono text-base font-medium tabular-nums">
                        {formatAmount(row.held)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-fg-2">Released</span>
                      <span className="font-mono text-base font-medium tabular-nums">
                        {formatAmount(row.released)}
                      </span>
                    </div>
                  </div>
                  {row.teams.length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {row.teams.map((team) => (
                        <li key={team.slug} className="flex items-center gap-2">
                          <TeamMark
                            image={team.image}
                            team={team.name}
                            size="sm"
                          />
                          <span className="w-24 shrink-0 truncate text-sm capitalize">
                            {team.name}
                          </span>
                          <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                            <span
                              className="w-(--pct) rounded-full bg-(--tone)"
                              style={
                                {
                                  "--tone": `var(--team-${team.tone})`,
                                  "--pct": `${(team.n / most) * 100}%`,
                                } as React.CSSProperties
                              }
                            />
                          </span>
                          <span className="w-4 text-end font-mono text-sm tabular-nums">
                            {team.n}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

export default function OrganizerPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
