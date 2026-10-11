import Link from "next/link";
import { Button } from "@/components/lime/ui/button";
import { HeroShowcase } from "./_components/hero-showcase";

const STEPS = [
  {
    label: "01",
    title: "Pick a seat",
    text: "Choose a section on the stadium map, then a seat in it. Every seat has one ticket for each team that could still get there.",
  },
  {
    label: "02",
    title: "Pick your team",
    text: "Your ticket costs the seat's full price times your team's share of the live odds. A long shot costs a few dollars.",
  },
  {
    label: "03",
    title: "Wait for the final",
    text: "If your team gets there, your ticket becomes the seat. You can resell it at your own price any time before.",
  },
];

const BUILT_ON = [
  {
    label: "Gemini",
    title: "Sets the price",
    text: "Live prediction market odds decide what each team's ticket costs, and which ticket wins the seat.",
  },
  {
    label: "XRP Ledger",
    title: "Holds the ticket and the money",
    text: "Your payment is locked in escrow and the ticket moves to you in one step. Resales pay the organizer 5%.",
  },
  {
    label: "Context.dev",
    title: "Checks the event is real",
    text: "An event goes on sale only if its details match its official page and the rest of the web.",
  },
];

type Point = { label: string; title: string; text: string };

/** A titled row of three cards. Every section under the hero is one of these. */
function Points({
  id,
  title,
  points,
}: {
  id?: string;
  title: string;
  points: Point[];
}) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-8">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {points.map((point) => (
          <li
            key={point.title}
            className="flex flex-col gap-2 rounded-panel bg-surface p-6"
          >
            <span className="pb-4 text-sm font-medium text-fg-2 tabular-nums">
              {point.label}
            </span>
            <span className="text-lg font-semibold">{point.title}</span>
            <span className="text-base leading-normal text-fg-2">
              {point.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-24 px-4 pt-12 pb-24 sm:px-6 sm:pt-20">
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
        <div className="w-full pt-6">
          <HeroShowcase />
        </div>
      </section>

      <Points id="how-it-works" title="How it works" points={STEPS} />

      <Points title="What it runs on" points={BUILT_ON} />

      <section className="flex flex-col items-center gap-8 text-center">
        <h2 className="max-w-2xl text-2xl leading-tight font-semibold tracking-tight">
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
