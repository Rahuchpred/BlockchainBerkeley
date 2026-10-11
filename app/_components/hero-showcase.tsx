"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";
import { cn } from "@/lib/lime/utils";

/** Captures of the running app, each a 1440 by 900 window at 2x. */
const SCREENS = [
  {
    id: "stadium",
    label: "Pick a seat",
    src: "/screens/stadium.png",
    alt: "The event page for the Pro Football Championship: a stadium map with three sections on sale, and the seats of section 104 beside it.",
  },
  {
    id: "teams",
    label: "Pick your team",
    src: "/screens/teams.png",
    alt: "One seat with a ticket for each team, priced by its odds: Buffalo at $210.53, Kansas City at $173.68, down to Cincinnati at $84.21.",
  },
  {
    id: "market",
    label: "The market",
    src: "/screens/market.png",
    alt: "The market page: one chart with a line for each team's chance of making the final over the last month.",
  },
  {
    id: "ticket",
    label: "Your ticket",
    src: "/screens/ticket.png",
    alt: "A bought ticket for section 104, row 8, seat 5 if Kansas City make the final, with what was paid, what it is worth now and its record on the ledger.",
  },
  {
    id: "organizer",
    label: "Organizer",
    src: "/screens/organizer.png",
    alt: "The organizer dashboard: tickets sold, money held in escrow, money released, and sales by team for each event.",
  },
  {
    id: "gate-pass",
    label: "Gate pass",
    src: "/screens/gate-pass.png",
    alt: "The winning ticket as a gate pass: marked admit one, with a code to show at the gate.",
  },
];

/** How long one screen stays before the next fades in. */
const HOLD_MS = 5000;

/**
 * The app itself as the page's picture: its screens stacked in one frame, fading from one to the
 * next. It moves on by itself until the visitor picks a screen, and never when they ask for less
 * motion.
 */
export function HeroShowcase() {
  const [current, setCurrent] = useState(SCREENS[0].id);
  const [picked, setPicked] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const labels = useRef<HTMLDivElement>(null);

  const paused = picked || hovered || focused;

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setCurrent((id) => {
        const index = SCREENS.findIndex((screen) => screen.id === id);
        return SCREENS[(index + 1) % SCREENS.length].id;
      });
    }, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [current, paused]);

  // On a phone the labels scroll sideways, so the current one is brought into view. Only the row
  // scrolls, never the page.
  useEffect(() => {
    const row = labels.current;
    const item = row?.querySelector<HTMLElement>("[data-checked]");
    if (!row || !item) return;
    const rowBox = row.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    const left =
      row.scrollLeft +
      itemBox.left -
      rowBox.left -
      (rowBox.width - itemBox.width) / 2;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    row.scrollTo({ left, behavior: reduced ? "auto" : "smooth" });
  }, [current]);

  return (
    <div
      className="flex flex-col items-center gap-4"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
    >
      <div className="relative aspect-16/10 w-full overflow-hidden rounded-panel border border-line bg-page">
        {SCREENS.map((screen, index) => {
          const shown = screen.id === current;
          return (
            <div
              key={screen.id}
              aria-hidden={!shown}
              className={cn(
                "absolute inset-0 transition-opacity duration-(--dur-slow) ease-out motion-reduce:transition-none",
                shown ? "opacity-100" : "opacity-0",
              )}
            >
              <Image
                src={screen.src}
                alt={screen.alt}
                fill
                sizes="(min-width: 1024px) 976px, calc(100vw - 2rem)"
                preload={index === 0}
                className="object-cover object-top"
              />
            </div>
          );
        })}
      </div>

      <div ref={labels} className="max-w-full overflow-x-auto rounded-control">
        <Segmented
          value={current}
          onValueChange={(value) => {
            setCurrent(value);
            setPicked(true);
          }}
          aria-label="Screen of the app to show"
          className="max-w-none"
        >
          {SCREENS.map((screen) => (
            <SegmentedItem key={screen.id} value={screen.id}>
              {screen.label}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>
    </div>
  );
}
