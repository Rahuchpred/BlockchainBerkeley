import { Suspense } from "react";
import { Badge } from "@/components/lime/ui/badge";
import { notFound } from "next/navigation";
import { formatAmount } from "@/components/lime/ui/amount";
import {
  EVENTS,
  conditionOf,
  fansOf,
  formatDate,
  placeOf,
  priceFor,
  seatLabel,
  type Seat,
} from "@/lib/fairseat/data";
import { findEvent } from "@/lib/fairseat/events";
import {
  holderOf,
  releasedTickets,
  soldTickets,
} from "@/lib/fairseat/store";
import { readWallet } from "@/lib/fairseat/wallet";
import { Button } from "@/components/lime/ui/button";
import Link from "next/link";
import { fromPrice, loadSides, type LiveSide } from "@/lib/fairseat/live";
import { SeatFinder } from "../../_components/seat-finder";
import type { SectionInfo } from "../../_components/stadium-map";
import { PageSkeleton } from "../../_components/page-skeleton";

export function generateStaticParams() {
  return EVENTS.map((event) => ({ id: event.id }));
}

function seatSummary(seat: Seat, side: LiveSide) {
  if (side.settled) return `${side.settled} ${conditionOf(side).made}`;
  if (side.onSale.length === 0) return "No tickets on sale yet";
  const prices = side.onSale.map((outcome) => priceFor(seat, outcome.share));
  return `${side.onSale.length} teams, ${formatAmount(Math.min(...prices))} to ${formatAmount(Math.max(...prices))}`;
}

/** Where teams sell their own tickets: how many of them have released theirs for a seat. */
const releasedSummary = (teams: number) =>
  teams === 0
    ? "No team has released a ticket yet"
    : `${teams} ${teams === 1 ? "team has" : "teams have"} released a ticket`;

async function EventPageContent({
  params,
}: Pick<PageProps<"/events/[id]">, "params">) {
  const { id } = await params;
  const event = findEvent(id);
  if (!event) notFound();

  const sides = await loadSides(event);
  const from = fromPrice(event, sides);
  // Set when the seats are decided by something other than a place in this event's own final.
  const own = sides[0]?.condition;
  const sideOf = (seat: Seat) => sides.find((side) => side.id === seat.side);

  const wallet = await readWallet();
  const sold = soldTickets().filter((ticket) => ticket.eventId === event.id);
  const released = releasedTickets().filter(
    (ticket) => ticket.eventId === event.id,
  );

  const seats = event.seats.map((seat) => {
    const side = sideOf(seat);
    const taken = sold.filter((ticket) => ticket.seatId === seat.id);
    return {
      row: seat.row,
      seat: seat.seat,
      sold: taken.length,
      teams: side?.outcomes.length ?? 0,
      mine:
        wallet !== null &&
        taken.some((ticket) => holderOf(ticket.nftId) === wallet.address),
      id: seat.id,
      side: seat.side,
      section: seat.section,
      label: seatLabel(seat),
      summary: !side
        ? ""
        : event.teamWallets && !side.settled
          ? releasedSummary(
              released.filter((ticket) => ticket.seatId === seat.id).length,
            )
          : seatSummary(seat, side),
      faceValue: seat.faceValue,
      href: `/events/${event.id}/seats/${seat.id}`,
    };
  });

  const sections: Record<string, SectionInfo> = {};
  for (const seat of event.seats) {
    const side = sideOf(seat);
    if (!side || side.onSale.length === 0) continue;
    const cheapest = Math.min(
      ...side.onSale.map((outcome) => priceFor(seat, outcome.share)),
    );
    const known = sections[seat.section];
    sections[seat.section] = {
      seats: (known?.seats ?? 0) + 1,
      from: known?.from == null ? cheapest : Math.min(known.from, cheapest),
    };
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="title-page">{event.title}</h1>
        <p className="text-base text-fg-2">
          {formatDate(event.date)} at {placeOf(event)}
        </p>
        {event.checkedAgainst && (
          <div>
            <Badge variant="success">{`Details checked against ${event.checkedAgainst}`}</Badge>
          </div>
        )}
        <p className="max-w-xl text-sm leading-normal text-fg-2">
          {own
            ? `Nobody knows which team ${own.makes} yet, so each seat has one ticket per team.`
            : "Nobody knows the finalists yet, so each seat has one ticket per team."}
          {sides.length > 1 &&
            ` The stadium is split in half: the ${sides[0].name} and the ${sides[1].name} each send one team to the final, so each half has its own teams and its own odds.`}
          {from === null
            ? own
              ? ` ${own.decided.replace(/^t/, "T")}, so that team's tickets are now real seats.`
              : " The finalists are decided, so the tickets for them are now real seats."
            : ` Tickets start at ${formatAmount(from)}.`}
        </p>
        <div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/events/${event.id}/market`} />}
          >
            See the market
          </Button>
        </div>
      </header>
      <SeatFinder
        title={event.title}
        map={event.map}
        sides={sides.map((side) => ({
          id: side.id,
          name: side.name,
          fans: fansOf(side),
          shares: side.onSale,
        }))}
        seats={seats}
        sections={sections}
      />
    </main>
  );
}

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <EventPageContent params={params} />
      </Suspense>
    </>
  );
}
