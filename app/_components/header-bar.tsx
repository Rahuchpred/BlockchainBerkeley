"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/lime/ui/button";
import { Logo } from "./logo";

// Fairseat has two sides with their own pages: fans browse events and hold tickets, clubs release
// and track them. Every page under /organizer is the club side. The last link crosses to the other
// side, and on a phone it gives up its room: the home page leads there.
const SIDES = {
  fan: [
    { href: "/events", label: "Events", wide: false },
    { href: "/tickets", label: "Tickets", wide: false },
    { href: "/organizer/nba", label: "For clubs", wide: true },
  ],
  club: [
    { href: "/organizer/nba", label: "Club desk", wide: false },
    { href: "/organizer", label: "Dashboard", wide: false },
    { href: "/events", label: "Fan view", wide: true },
  ],
};

// The header for whichever side the page is on. The fan's wallet and the club's name are rendered
// on the server and handed in, and the side picks which one shows.
export function HeaderBar({
  wallet,
  team,
}: {
  wallet: React.ReactNode;
  team: React.ReactNode;
}) {
  const path = usePathname();
  const side = path.startsWith("/organizer") ? "club" : "fan";

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-page">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Fairseat, home"
          className="flex items-center gap-2 rounded-sm text-base font-semibold text-fg"
        >
          <Logo className="size-6 shrink-0 text-accent" />
          {/* On a phone the mark stands alone, so the balance has room to show in full. */}
          <span className="hidden sm:inline">Fairseat</span>
        </Link>
        <nav aria-label="Main" className="ms-auto flex items-center gap-1">
          {SIDES[side].map((link) => (
            <Button
              key={link.label}
              variant="ghost"
              size="sm"
              className={link.wide ? "hidden sm:inline-flex" : undefined}
              aria-current={path === link.href ? "page" : undefined}
              nativeButton={false}
              render={<Link href={link.href} />}
            >
              {link.label}
            </Button>
          ))}
        </nav>
        {side === "club" ? team : wallet}
      </div>
    </header>
  );
}
