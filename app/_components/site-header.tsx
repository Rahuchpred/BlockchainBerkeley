import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/lime/ui/button";
import { Skeleton } from "@/components/lime/ui/skeleton";
import { readSession, type Session } from "@/lib/fairseat/session";
import { readWallet } from "@/lib/fairseat/wallet";
import { getBalance } from "@/lib/fairseat/xrpl";
import { logOut } from "../actions";
import { Logo } from "./logo";
import { WalletChip } from "./wallet-chip";

// What each kind of account is called beside its name, and the pages it can open.
const ACCOUNTS: Record<
  Session["kind"],
  { role: string; links: { href: string; label: string; wide?: boolean }[] }
> = {
  buyer: {
    role: "Buyer",
    links: [
      { href: "/events", label: "Events" },
      { href: "/tickets", label: "Tickets" },
    ],
  },
  team: {
    role: "Organizer",
    links: [{ href: "/organizer/nba", label: "Club desk", wide: true }],
  },
  house: {
    role: "Organizer",
    links: [
      { href: "/organizer", label: "Dashboard" },
      { href: "/organizer/new", label: "List an event", wide: true },
    ],
  },
};

async function WalletSlot() {
  const wallet = await readWallet();
  // The ledger can be slow or briefly unreachable. The header must not take the page down with it.
  const balance = wallet
    ? await getBalance(wallet.address).catch(() => null)
    : null;
  return <WalletChip balance={balance} />;
}

function Bar({
  side,
  below,
  children,
}: {
  side?: "buyer" | "organizer";
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
          href="/"
          aria-label="Fairseat, home"
          className="me-auto flex items-center gap-2 rounded-sm text-base font-semibold text-fg"
        >
          <Logo className="size-6 shrink-0 text-accent" />
          {/* On a phone the mark stands alone, so the balance has room to show in full. */}
          <span className="hidden sm:inline">Fairseat</span>
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
  if (!session)
    return (
      <Bar>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Log in
        </Button>
      </Bar>
    );
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
    <Suspense fallback={<Bar />}>
      <Account />
    </Suspense>
  );
}
