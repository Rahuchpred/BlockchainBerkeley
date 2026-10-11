import { Suspense } from "react";
import { formatDate, placeOf } from "@/lib/fairseat/data";
import { allEvents } from "@/lib/fairseat/events";
import { fromPrice, loadSides, loadWatched } from "@/lib/fairseat/live";
import { EventBrowser } from "../_components/event-browser";
import { PageSkeleton } from "../_components/page-skeleton";
import { WatchList } from "../_components/watch-list";

async function Events() {
  const watching = loadWatched();
  const events = await Promise.all(
    allEvents().map(async (event) => {
      const sides = await loadSides(event);
      return {
        id: event.id,
        title: event.title,
        sport: event.sport,
        date: formatDate(event.date),
        place: placeOf(event),
        // The likeliest teams across both sides, as the card's picture.
        teams: sides
          .flatMap((side) => side.onSale.slice(0, 3))
          .sort((a, b) => b.share - a.share)
          .slice(0, 5)
          .map((outcome) => ({ team: outcome.team, image: outcome.image })),
        shares: sides[0]?.onSale ?? [],
        from: fromPrice(event, sides),
        note: event.note,
      };
    }),
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="title-page">Events</h1>
        <p className="max-w-xl text-base leading-normal text-fg-2">
          Each seat is sold once per team. You pay for your team&apos;s chance
          of getting there, and the seat is yours if they do.
        </p>
      </header>
      <EventBrowser events={events} />
      <WatchList markets={await watching} />
    </main>
  );
}

export default function EventsPage() {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <Events />
      </Suspense>
    </>
  );
}
