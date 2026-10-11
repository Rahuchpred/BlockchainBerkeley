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
import { Icon, ArrowLeft } from "@/components/lime/icon";
import {
  NBA_CONFERENCES,
  formatDate,
  percent,
  placeOf,
  priceFor,
  seatLabel,
  slug,
} from "@/lib/fairseat/data";
import { allEvents } from "@/lib/fairseat/events";
import { loadSides } from "@/lib/fairseat/live";
import { readTeam, teamName } from "@/lib/fairseat/team";
import {
  allActivity,
  paidFor,
  pendingEscrows,
  releasedTickets,
  soldTickets,
} from "@/lib/fairseat/store";
import { shortAddress } from "@/lib/fairseat/story";
import { accountUrl, getTeamOrganizer, txUrl } from "@/lib/fairseat/xrpl";
import { PageSkeleton } from "../../_components/page-skeleton";
import { ReleaseList } from "../../_components/release-list";
import { Stat } from "../../_components/stat";
import { TeamPicker } from "../../_components/team-picker";

const GROUPS = Object.values(NBA_CONFERENCES).map((conference) => ({
  name: conference.title.replace(" Champion", ""),
  teams: conference.teams.map((name) => ({ value: slug(name), label: name })),
}));

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

async function Desk() {
  await connection();
  const team = await readTeam();
  const name = teamName(team) ?? team;
  // If the ledger cannot be reached, the page still loads and says so.
  const wallet = await getTeamOrganizer(team).catch(() => null);
  const sold = new Set(soldTickets().map((ticket) => ticket.nftId));
  const escrows = pendingEscrows();
  const activity = allActivity();
  const mine = releasedTickets().filter((ticket) => ticket.team === team);
  const paidOut = activity.filter(
    (step) => step.kind === "released" && step.team === team,
  );

  // Every event whose teams sell their own tickets, with this team's side of it.
  const events = (
    await Promise.all(
      allEvents()
        .filter((event) => event.teamWallets)
        .map(async (event) => {
          const sides = await loadSides(event);
          const side = sides.find((item) =>
            item.outcomes.some((outcome) => outcome.slug === team),
          );
          const outcome = side?.outcomes.find((item) => item.slug === team);
          return side && outcome ? [{ event, side, outcome }] : [];
        }),
    )
  ).flat();

  const tickets = mine.flatMap((ticket) => {
    const found = events.find((item) => item.event.id === ticket.eventId);
    const seat = found?.event.seats.find((item) => item.id === ticket.seatId);
    if (!found || !seat) return [];
    const escrow = escrows[ticket.nftId];
    return [
      {
        ...ticket,
        event: found.event.title,
        seat: seatLabel(seat),
        state: !sold.has(ticket.nftId)
          ? found.side.settled
            ? ("expired" as const)
            : ("open" as const)
          : escrow
            ? ("escrow" as const)
            : ("paid" as const),
        amount: sold.has(ticket.nftId)
          ? (escrow?.amount ?? paidFor(ticket.nftId) ?? 0)
          : priceFor(seat, found.outcome.share),
        minted: activity.find(
          (step) => step.kind === "minted" && step.nftId === ticket.nftId,
        )?.hash,
      },
    ];
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to the organizer page"
            nativeButton={false}
            render={<Link href="/organizer" />}
            icon={<Icon icon={ArrowLeft} size={20} />}
          />
          <div className="flex flex-col gap-2">
            <h1 className="title-page">{`${name} team desk`}</h1>
            <p className="max-w-xl text-base leading-normal text-fg-2">
              Each NBA team releases its own tickets from its own wallet on the
              XRP Ledger, and is paid into that wallet.
            </p>
          </div>
        </div>
        <TeamPicker team={team} groups={GROUPS} />
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Tickets released"
          value={String(mine.length)}
          note="Minted by this team's wallet"
        />
        <Stat
          label="Tickets sold"
          value={String(mine.filter((ticket) => sold.has(ticket.nftId)).length)}
          note={`${mine.filter((ticket) => !sold.has(ticket.nftId)).length} still on sale`}
        />
        <Stat
          label="Held in escrow"
          value={formatAmount(
            sum(mine.map((ticket) => escrows[ticket.nftId]?.amount ?? 0)),
          )}
          note="The team's once the finalists are decided"
        />
        <Stat
          label="Paid to the team"
          value={formatAmount(sum(paidOut.map((step) => step.amount ?? 0)))}
          note="From settled events"
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{`The ${name} wallet on the ledger`}</h2>
        {wallet ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-fg-2">
              {shortAddress(wallet.address)}
              {wallet.ready
                ? ` holds ${formatAmount(wallet.balance)}`
                : " is not open yet"}
            </p>
            {wallet.ready && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={accountUrl(wallet.address)}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                View the account
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm leading-normal text-fg-2">
            The ledger could not be reached. Reload to try again.
          </p>
        )}
        {wallet && !wallet.ready && (
          <p className="max-w-xl text-sm leading-normal text-fg-2">
            The wallet is opened on the testnet the first time the team
            releases tickets.
          </p>
        )}
      </section>

      {events.map(({ event, side, outcome }) => (
        <section key={event.id} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{`Release tickets for ${event.title}`}</h2>
          <p className="max-w-xl text-sm leading-normal text-fg-2">
            {formatDate(event.date)} at {placeOf(event)}. {name} are on the{" "}
            {side.name}.{" "}
            {side.settled
              ? `${side.settled} made the final, so no more tickets can be released.`
              : `A released ticket goes on sale at ${percent(outcome.share)} of its seat's full price, the team's share at the live odds.`}
          </p>
          {!side.settled && (
            <ReleaseList
              eventId={event.id}
              team={name}
              ready={wallet?.ready ?? false}
              rows={[
                ...new Set(
                  event.seats
                    .filter((seat) => seat.side === side.id)
                    .map((seat) => seat.section),
                ),
              ].map((section) => {
                const seats = event.seats.filter(
                  (seat) => seat.side === side.id && seat.section === section,
                );
                return {
                  section,
                  seats: seats.length,
                  released: seats.filter((seat) =>
                    mine.some(
                      (ticket) =>
                        ticket.eventId === event.id &&
                        ticket.seatId === seat.id,
                    ),
                  ).length,
                  price: priceFor(seats[0], outcome.share),
                };
              })}
            />
          )}
        </section>
      ))}

      {tickets.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Released tickets</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seat</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-end">Price</TableHead>
                <TableHead>Proof</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.nftId}>
                  <TableCell className="whitespace-nowrap">
                    {ticket.seat}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-fg-2">
                    {ticket.event}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {ticket.state === "open" ? (
                      <Badge variant="neutral">On sale</Badge>
                    ) : ticket.state === "expired" ? (
                      <Badge variant="outline">Not sold</Badge>
                    ) : ticket.state === "escrow" ? (
                      <Badge variant="warn">Sold, payment in escrow</Badge>
                    ) : (
                      <Badge variant="success">Sold and paid</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-end font-mono tabular-nums">
                    {formatAmount(ticket.amount)}
                  </TableCell>
                  <TableCell>
                    {ticket.minted && (
                      <Button
                        variant="link"
                        size="sm"
                        nativeButton={false}
                        render={
                          <a
                            href={txUrl(ticket.minted)}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        Mint transaction
                      </Button>
                    )}
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

export default function TeamDeskPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Desk />
    </Suspense>
  );
}
