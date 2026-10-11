import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/lime/ui/button";
import { Skeleton } from "@/components/lime/ui/skeleton";
import { HOME, readSession, type Session } from "@/lib/fairseat/session";
import { readWallet } from "@/lib/fairseat/wallet";
import { getBalance } from "@/lib/fairseat/xrpl";
import { logOut } from "../actions";
import { WalletChip } from "./wallet-chip";

// What each kind of account is called beside its name, and the pages it can open.
const ACCOUNTS: Record<
  Session["kind"],
  { role: string; links: { href: string; label: string; wide?: boolean }[] }
> = {
  buyer: {
    role: "Buyer",
    links: [
      // On a phone the name already leads to the events, so this link gives up its room.
      { href: "/", label: "Events", wide: true },
      { href: "/tickets", label: "Tickets" },
    ],
  },
  team: { role: "Organizer", links: [] },
  house: {
    role: "Organizer",
    links: [{ href: "/organizer/new", label: "List an event", wide: true }],
  },
};

async function WalletSlot() {
  const wallet = await readWallet();
  // If the ledger cannot be reached, the chip reads "Unavailable" instead of a wrong $0.
  const balance = wallet
    ? await getBalance(wallet.address).catch(() => Number.NaN)
    : null;
  return <WalletChip balance={balance} />;
}

function Bar({
  side,
  home,
  below,
  children,
}: {
  side?: "buyer" | "organizer";
  home: string;
  /** A second row, for what the top row has no room for on a narrow screen. */
  below?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    // data-side is what app/sides.css tints the whole page by.
    <header
      data-side={side}
      className="sticky top-0 z-10 border-b border-line bg-page"
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
        <Link
          href={home}
          className="me-auto rounded-sm text-base font-semibold text-fg"
        >
          Fairseat
        </Link>
        {children}
      </div>
      {below && (
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 pb-2 sm:hidden">
          {below}
        </div>
      )}
    </header>
  );
}

async function Account() {
  // Who is logged in is per visitor, so the header renders per request.
  await connection();
  const session = await readSession();
  if (!session) return <Bar home="/login" />;
  const { role, links } = ACCOUNTS[session.kind];
  // Who this is, always in view: the role in grey, then the name. Then the way out.
  const account = (
    <>
      <p className="flex min-w-0 items-baseline gap-1.5 px-2 text-sm font-medium">
        <span className="font-normal text-fg-2">{role}</span>
        <span className="truncate">{session.name}</span>
      </p>
      <form action={logOut}>
        <Button type="submit" variant="outline" size="sm">
          Log out
        </Button>
      </form>
    </>
  );

  return (
    <Bar
      side={session.kind === "buyer" ? "buyer" : "organizer"}
      home={HOME[session.kind]}
      below={account}
    >
      <nav aria-label="Main" className="flex items-center gap-1">
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
      {session.kind === "buyer" && (
        // The stand-in holds the chip's space so the bar does not shift when the balance arrives.
        <Suspense fallback={<Skeleton shape="block" className="h-8 w-28" />}>
          <WalletSlot />
        </Suspense>
      )}
      <div className="hidden items-center gap-2 sm:flex">{account}</div>
    </Bar>
  );
}

export function SiteHeader() {
  return (
    <Suspense fallback={<Bar home="/login" />}>
      <Account />
    </Suspense>
  );
}
