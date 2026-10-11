import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/lime/ui/button";
import { Skeleton } from "@/components/lime/ui/skeleton";
import { readTeam, teamName } from "@/lib/fairseat/team";
import { readWallet } from "@/lib/fairseat/wallet";
import { getBalance } from "@/lib/fairseat/xrpl";
import { HeaderBar } from "./header-bar";
import { Logo } from "./logo";
import { WalletChip } from "./wallet-chip";

async function WalletSlot() {
  // The wallet is per visitor, so this part of the header is rendered per request.
  await connection();
  const wallet = await readWallet();
  // The ledger can be slow or briefly unreachable. The header must not take the page down with it.
  const balance = wallet
    ? await getBalance(wallet.address).catch(() => null)
    : null;
  return <WalletChip balance={balance} />;
}

async function TeamSlot() {
  // The club a visitor acts for is per visitor, so this part renders per request.
  await connection();
  return (
    <Button
      variant="secondary"
      size="sm"
      nativeButton={false}
      render={<Link href="/organizer/nba" />}
    >
      {teamName(await readTeam())}
    </Button>
  );
}

// The stand-in holds a chip's space so the links do not slide when it arrives.
const chip = <Skeleton shape="block" className="h-8 w-28" />;

export function SiteHeader() {
  return (
    // The side comes from the address, which is not known while a page with an open-ended address
    // is prepared ahead of time, so the bar has a stand-in for that moment.
    <Suspense
      fallback={
        <header className="sticky top-0 z-10 border-b border-line bg-page">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
            <span className="me-auto flex items-center gap-2 text-base font-semibold text-fg">
              <Logo className="size-6 shrink-0 text-accent" />
              <span className="hidden sm:inline">Fairseat</span>
            </span>
            {chip}
          </div>
        </header>
      }
    >
      <HeaderBar
        wallet={
          <Suspense fallback={chip}>
            <WalletSlot />
          </Suspense>
        }
        team={
          <Suspense fallback={chip}>
            <TeamSlot />
          </Suspense>
        }
      />
    </Suspense>
  );
}
