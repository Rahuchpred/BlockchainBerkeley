import { Suspense } from "react";
import { notFound } from "next/navigation";
import { formatAmount } from "@/components/lime/ui/amount";
import {
  EVENTS,
  formatDate,
  getEvent,
  priceFor,
  seatLabel,
  type Seat,
} from "@/lib/fairseat/data";
import { fromPrice, loadSides, type LiveSide } from "@/lib/fairseat/live";
import { SeatFinder } from "../../_components/seat-finder";
import type { SectionInfo } from "../../_components/stadium-map";
import { PageSkeleton } from "../../_components/page-skeleton";

export function generateStaticParams() {
  return EVENTS.map((event) => ({ id: event.id }));
}

function seatSummary(seat: Seat, side: LiveSide) {
  if (side.settled) return `${side.settled} made the final`;
  if (side.onSale.length === 0) return "No tickets on sale yet";
  const prices = side.onSale.map((outcome) => priceFor(seat, outcome.share));
  return `${side.onSale.length} teams, ${formatAmount(Math.min(...prices))} to ${formatAmount(Math.max(...prices))}`;
}

async function EventPageContent({
  params,
}: Pick<PageProps<"/events/[id]">, "params">) {
  const { id } = await params;
  const event = getEvent(id);
  if (!event) notFound();

  const sides = await loadSides(event);
  const from = fromPrice(event, sides);
  const sideOf = (seat: Seat) => sides.find((side) => side.id === seat.side);

  const seats = event.seats.map((seat) => {
    const side = sideOf(seat);
    return {
      id: seat.id,
      side: seat.side,
      section: seat.section,
      label: seatLabel(seat),
      summary: side ? seatSummary(seat, side) : "",
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
          {formatDate(event.date)} at {event.venue}, {event.city}
        </p>
        <p className="max-w-xl text-sm leading-normal text-fg-2">
          Nobody knows the finalists yet, so each seat has one ticket per team.
          {from === null
            ? " The finalists are decided, so the tickets for them are now real seats."
            : ` Tickets start at ${formatAmount(from)}.`}
        </p>
      </header>
      <SeatFinder
        title={event.title}
        map={event.map}
        sides={sides.map((side) => ({
          id: side.id,
          name: side.name,
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
