import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/lime/ui/button";
import { Skeleton } from "@/components/lime/ui/skeleton";
import { priceFor } from "@/lib/fairseat/data";
import { allEvents } from "@/lib/fairseat/events";
import { loadSides } from "@/lib/fairseat/live";
import {
  HeroPreview,
  type PreviewSection,
  type PreviewTeam,
} from "./_components/hero-preview";
import type { SectionInfo } from "./_components/stadium-map";

const STEPS = [
  {
    title: "Pick a seat",
    text: "Choose a section on the stadium map, then a seat in it. Every seat has one ticket for each team that could still get there.",
  },
  {
    title: "Pick your team",
    text: "Your ticket costs the seat's full price times your team's share of the live odds. A long shot costs a few dollars.",
  },
  {
    title: "Wait for the final",
    text: "If your team gets there, your ticket becomes the seat. You can resell it at your own price any time before.",
  },
];

const BUILT_ON = [
  {
    name: "Gemini",
    job: "Sets the price",
    text: "Live prediction market odds decide what each team's ticket costs, and which ticket wins the seat.",
  },
  {
    name: "XRP Ledger",
    job: "Holds the ticket and the money",
    text: "Your payment is locked in escrow and the ticket moves to you in one step. Resales pay the organizer 5%.",
  },
  {
    name: "Context.dev",
    job: "Checks the event is real",
    text: "An event goes on sale only if its details match its official page and the rest of the web.",
  },
];

/** The first event, live, as the page's picture. */
async function Preview() {
  const event = allEvents()[0];
  if (!event) return null;
  const sides = await loadSides(event);

  const info: Record<string, SectionInfo> = {};
  const sections: Record<string, PreviewSection> = {};
  for (const seat of event.seats) {
    const side = sides.find((item) => item.id === seat.side);
    if (!side || side.onSale.length === 0) continue;
    const cheapest = Math.min(
      ...side.onSale.map((outcome) => priceFor(seat, outcome.share)),
    );
    const known = info[seat.section];
    info[seat.section] = {
      seats: (known?.seats ?? 0) + 1,
      from: known?.from == null ? cheapest : Math.min(known.from, cheapest),
    };
    sections[seat.section] ??= {
      side: seat.side,
      faceValue: seat.faceValue,
      href: `/events/${event.id}/seats/${seat.id}`,
    };
  }
  if (Object.keys(sections).length === 0) return null;

  const teams: Record<string, PreviewTeam[]> = Object.fromEntries(
    sides.map((side) => [
      side.id,
      side.onSale.map((outcome) => ({
        team: outcome.team,
        share: outcome.share,
        tone: outcome.tone,
        image: outcome.image,
      })),
    ]),
  );

  return (
    <HeroPreview
      title={event.title}
      eventHref={`/events/${event.id}`}
      map={event.map}
      info={info}
      sections={sections}
      teams={teams}
      split={sides.length > 1}
    />
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
      <section className="flex flex-col items-center gap-6 text-center">
        <h1 className="max-w-3xl text-3xl leading-tight font-semibold tracking-tight">
          One seat. Sold once per team.
        </h1>
        <p className="max-w-xl text-lg leading-normal text-fg-2">
          Buy your seat at the final before the finalists are known. You pay for
          your team&apos;s chance of getting there, and the seat is yours if
          they do.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/events" />}
          >
            See the events
          </Button>
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<a href="#how-it-works" />}
          >
            How it works
          </Button>
        </div>
        <div className="w-full pt-4">
          <Suspense fallback={<Skeleton shape="block" className="h-96" />}>
            <Preview />
          </Suspense>
        </div>
      </section>

      <section id="how-it-works" className="flex scroll-mt-20 flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex flex-col gap-2 border-t border-line-strong pt-4"
            >
              <span className="font-mono text-sm text-fg-3">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-lg font-semibold">{step.title}</span>
              <span className="text-base leading-normal text-fg-2">
                {step.text}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          What it runs on
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {BUILT_ON.map((item) => (
            <li
              key={item.name}
              className="flex flex-col gap-2 rounded-panel bg-surface p-4"
            >
              <span className="text-sm text-fg-2">{item.name}</span>
              <span className="text-lg font-semibold">{item.job}</span>
              <span className="text-base leading-normal text-fg-2">
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col items-center gap-6 py-8 text-center">
        <h2 className="max-w-2xl text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Only pay for the chance your team gets there.
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            variant="solid"
            size="lg"
            nativeButton={false}
            render={<Link href="/events" />}
          >
            Pick your seat
          </Button>
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href="/organizer" />}
          >
            I run an event
          </Button>
        </div>
      </section>
    </main>
  );
}
