"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/lime/ui/button";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";

// Fairseat has two sides with their own pages: buyers browse events and hold tickets, organizers
// release and track them. Every page under /organizer is the organizer side.
const SIDES = {
  buyer: {
    home: "/",
    links: [
      // On a phone the name already leads to the events, so this link gives up its room.
      { href: "/", label: "Events", wide: true },
      { href: "/tickets", label: "Tickets", wide: false },
    ],
  },
  organizer: {
    home: "/organizer/nba",
    links: [
      { href: "/organizer/nba", label: "Team desk", wide: false },
      { href: "/organizer", label: "Dashboard", wide: false },
    ],
  },
};

type Side = keyof typeof SIDES;

function SideSwitch({ side, fill }: { side: Side; fill?: boolean }) {
  const router = useRouter();
  return (
    <Segmented
      size="sm"
      fill={fill}
      value={side}
      aria-label="Side of Fairseat"
      onValueChange={(value) =>
        router.push(SIDES[value === "organizer" ? "organizer" : "buyer"].home)
      }
    >
      <SegmentedItem value="buyer">Buyer</SegmentedItem>
      <SegmentedItem value="organizer">Organizer</SegmentedItem>
    </Segmented>
  );
}

// The header for whichever side the page is on. The buyer's wallet and the organizer's team are
// rendered on the server and handed in, and the side picks which one shows. The header also carries
// the side as data-side, which is what app/sides.css tints the whole page by.
export function HeaderBar({
  wallet,
  team,
}: {
  wallet: React.ReactNode;
  team: React.ReactNode;
}) {
  const side: Side = usePathname().startsWith("/organizer")
    ? "organizer"
    : "buyer";
  const { home, links } = SIDES[side];

  return (
    <header
      data-side={side}
      className="sticky top-0 z-10 border-b border-line bg-page"
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
        <Link
          href={home}
          className="rounded-sm text-base font-semibold text-fg"
        >
          Fairseat
        </Link>
        <nav aria-label="Main" className="ms-auto flex items-center gap-1">
          {links.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              size="sm"
              className={link.wide ? "hidden sm:inline-flex" : undefined}
              nativeButton={false}
              render={<Link href={link.href} />}
            >
              {link.label}
            </Button>
          ))}
        </nav>
        <div className="hidden md:flex">
          <SideSwitch side={side} />
        </div>
        {side === "organizer" ? team : wallet}
      </div>
      {/* The top row has no room for the switch on a narrow screen, so it takes a row of its own. */}
      <div className="mx-auto flex w-full max-w-5xl px-4 pb-2 sm:px-6 md:hidden">
        <SideSwitch side={side} fill />
      </div>
    </header>
  );
}
