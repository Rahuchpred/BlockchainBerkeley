import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/lime/ui/button";
import {
  Empty,
  EmptyActions,
  EmptyDescription,
  EmptyTitle,
} from "@/components/lime/ui/empty";
import { Icon, ArrowLeft } from "@/components/lime/icon";
import {
  EVENTS,
  formatDate,
  getSeat,
  getSide,
  seatLabel,
} from "@/lib/fairseat/data";
import { findEvent } from "@/lib/fairseat/events";
import { getHistory } from "@/lib/fairseat/gemini";
import { loadSide } from "@/lib/fairseat/live";
import {
  holderOf,
  offerFor,
  releasedTicket,
  soldTicket,
  ticketKey,
} from "@/lib/fairseat/store";
import { shortAddress } from "@/lib/fairseat/story";
import { slug } from "@/lib/fairseat/data";
import { PageSkeleton } from "../../../../_components/page-skeleton";
import { TeamTickets } from "../../../../_components/team-tickets";

export function generateStaticParams() {
  return EVENTS.flatMap((event) =>
    event.seats.map((seat) => ({ id: event.id, seat: seat.id })),
  );
}

async function SeatPageContent({
  params,
}: Pick<PageProps<"/events/[id]/seats/[seat]">, "params">) {
  const { id, seat: seatId } = await params;
  const event = findEvent(id);
  const seat = event && getSeat(event, seatId);
  const config = event && seat && getSide(event, seat.side);
  if (!event || !seat || !config) notFound();

  const side = await loadSide(config);
  const teams = await Promise.all(
    side.onSale.map(async (outcome) => {
      const days = await getHistory(outcome.symbol, "1day");
      const last = days[days.length - 1];
      const before = days[days.length - 2];
      const key = ticketKey(event.id, seat.id, outcome.slug);
      const taken = soldTicket(key);
      const offer = taken ? offerFor(taken) : null;
      return {
        slug: outcome.slug,
        team: outcome.team,
        image: outcome.image,
        tone: outcome.tone,
        share: outcome.share,
        change: last && before ? last.v - before.v : 0,
        trend: days.slice(-30),
        sold: taken !== null,
        resale: offer && offer.price > 0 ? offer.price : null,
        unreleased:
          Boolean(event.teamWallets) && !taken && !releasedTicket(key),
      };
    }),
  );

  // Once the side has settled: who ended up with this seat.
  const winning =
    side.settled &&
    soldTicket(ticketKey(event.id, seat.id, slug(side.settled)));
  const holder = winning ? holderOf(winning) : null;
  const seatWinner = !side.settled
    ? ""
    : winning
      ? `This seat now belongs to the fan who held the ${side.settled} ticket${holder ? `, wallet ${shortAddress(holder)}` : ""}. The other tickets have expired.`
      : `Nobody bought the ${side.settled} ticket for this seat, so the seat is still the organizer's to sell. The other tickets have expired.`;

  return (
    <>
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
            <h1 className="title-page">{seatLabel(seat)}</h1>
            <p className="text-base text-fg-2">
              {event.title}, {side.name}. {formatDate(event.date)} at{" "}
              {event.venue}.
            </p>
          </div>
        </header>
        {teams.length === 0 ? (
          <Empty>
            <EmptyTitle>
              {side.settled
                ? `${side.settled} made the final`
                : "No tickets on sale yet"}
            </EmptyTitle>
            <EmptyDescription>
              {side.settled
                ? seatWinner
                : "The market has no prices for this side yet. Check back once trading starts."}
            </EmptyDescription>
            <EmptyActions>
              <Button
                variant="solid"
                nativeButton={false}
                render={<Link href={`/events/${event.id}`} />}
              >
                See other seats
              </Button>
            </EmptyActions>
          </Empty>
        ) : (
          <TeamTickets
            market={side.market}
            buyBase={`/events/${event.id}/seats/${seat.id}/buy`}
            faceValue={seat.faceValue}
            teams={teams}
          />
        )}
      </main>
    </>
  );
}

export default function SeatPage({
  params,
}: PageProps<"/events/[id]/seats/[seat]">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <SeatPageContent params={params} />
      </Suspense>
    </>
  );
}
