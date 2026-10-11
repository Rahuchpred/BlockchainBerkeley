import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/lime/ui/button";
import { Skeleton } from "@/components/lime/ui/skeleton";
import { readTeam, teamName } from "@/lib/fairseat/team";
import { readWallet } from "@/lib/fairseat/wallet";
import { getBalance } from "@/lib/fairseat/xrpl";
import { HeaderBar } from "./header-bar";
import { WalletChip } from "./wallet-chip";

async function WalletSlot() {
  // The wallet is per visitor and the balance is read from the ledger, so this part renders per request.
  await connection();
  const wallet = await readWallet();
  // If the ledger cannot be reached, the chip reads "Unavailable" instead of a wrong $0.
  const balance = wallet
    ? await getBalance(wallet.address).catch(() => Number.NaN)
    : null;
  return <WalletChip balance={balance} />;
}

async function TeamSlot() {
  // The team an organizer acts for is per visitor, so this part renders per request.
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
            <span className="me-auto text-base font-semibold text-fg">
              Fairseat
            </span>
            {chip}
          </div>
          <div className="mx-auto flex w-full max-w-5xl px-4 pb-2 sm:px-6 md:hidden">
            <Skeleton shape="block" className="h-8 w-full" />
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
