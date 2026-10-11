import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge } from "@/components/lime/ui/badge";
import { Button } from "@/components/lime/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/lime/ui/table";
import { formatAmount } from "@/components/lime/ui/amount";
import { formatDate } from "@/lib/fairseat/data";
import { allEvents } from "@/lib/fairseat/events";
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

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

async function Dashboard() {
  await connection();
  // Events whose teams sell their own tickets are paid into the teams' wallets, not this one.
  const events = allEvents().filter((event) => !event.teamWallets);
  const sold = soldTickets().filter((ticket) =>
    events.some((event) => event.id === ticket.eventId),
  );
  const escrows = pendingEscrows();
  const activity = allActivity();
  const account = organizerAddress();
  const balance = await getBalance(account).catch(() => Number.NaN);

  const released = activity.filter((step) => step.kind === "released");
  const resales = activity.filter((step) => step.kind === "resold");
  const amounts = (steps: typeof activity) =>
    steps.map((step) => step.amount ?? 0);

  const rows = events.map((event) => {
    const tickets = sold.filter((ticket) => ticket.eventId === event.id);
    const of = (steps: typeof activity) =>
      steps.filter((step) => step.eventId === event.id);
    return {
      event,
      tickets: tickets.length,
      held: sum(tickets.map((ticket) => escrows[ticket.nftId]?.amount ?? 0)),
      released: sum(amounts(of(released))),
      resale: sum(amounts(of(resales))) * RESALE_RATE,
    };
  });

  const byTeam = new Map<string, { event: string; team: string; n: number }>();
  for (const ticket of sold) {
    const event = events.find((item) => item.id === ticket.eventId);
    const key = `${ticket.eventId}|${ticket.team}`;
    const known = byTeam.get(key);
    byTeam.set(key, {
      event: event?.title ?? ticket.eventId,
      team: ticket.team,
      n: (known?.n ?? 0) + 1,
    });
  }
  const teams = [...byTeam.values()].sort((a, b) => b.n - a.n);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
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
        <Stat
          label="Tickets sold"
          value={String(sold.length)}
          note={`Across ${rows.length} events`}
        />
        <Stat
          label="Held in escrow"
          value={formatAmount(sum(rows.map((row) => row.held)))}
          note="Yours once the finalists are decided"
        />
        <Stat
          label="Released to you"
          value={formatAmount(sum(rows.map((row) => row.released)))}
          note="From settled events"
        />
        <Stat
          label="From resales"
          value={formatAmount(sum(rows.map((row) => row.resale)))}
          note={`${Math.round(RESALE_RATE * 100)}% of every resale, paid by the ledger`}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Your account on the ledger</h2>
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
              <a href={accountUrl(account)} target="_blank" rel="noreferrer" />
            }
          >
            View the account
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Events</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-end">Tickets sold</TableHead>
              <TableHead className="text-end">In escrow</TableHead>
              <TableHead className="text-end">Released</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.event.id}>
                <TableCell className="whitespace-nowrap">
                  <Button
                    variant="link"
                    nativeButton={false}
                    render={<Link href={`/events/${row.event.id}`} />}
                  >
                    {row.event.title}
                  </Button>
                </TableCell>
                <TableCell className="whitespace-nowrap text-fg-2">
                  {formatDate(row.event.date)}
                </TableCell>
                <TableCell className="text-end font-mono tabular-nums">
                  {row.tickets}
                </TableCell>
                <TableCell className="text-end font-mono tabular-nums">
                  {formatAmount(row.held)}
                </TableCell>
                <TableCell className="text-end font-mono tabular-nums">
                  {formatAmount(row.released)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.event.checkedAgainst ? (
                    <Badge variant="success">{`Checked against ${row.event.checkedAgainst}`}</Badge>
                  ) : (
                    <Badge variant="neutral">Listed by Fairseat</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">NBA teams</h2>
        <p className="max-w-xl text-sm leading-normal text-fg-2">
          The 30 NBA teams sell their own tickets. Each team releases them from
          its own wallet on the ledger and is paid into it.
        </p>
        <div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/organizer/nba" />}
          >
            Open the team desk
          </Button>
        </div>
      </section>

      {teams.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Tickets sold by team</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="text-end">Tickets sold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((row) => (
                <TableRow key={`${row.event}-${row.team}`}>
                  <TableCell className="whitespace-nowrap capitalize">
                    {row.team.replaceAll("-", " ")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-fg-2">
                    {row.event}
                  </TableCell>
                  <TableCell className="text-end font-mono tabular-nums">
                    {row.n}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
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
