import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/lime/ui/button";
import { Skeleton } from "@/components/lime/ui/skeleton";
import { readWallet } from "@/lib/fairseat/wallet";
import { getBalance } from "@/lib/fairseat/xrpl";
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

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-page">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="rounded-sm text-base font-semibold text-fg">
          Fairseat
        </Link>
        <nav aria-label="Main" className="ms-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Events
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/tickets" />}
          >
            My tickets
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            nativeButton={false}
            render={<Link href="/organizer/new" />}
          >
            List an event
          </Button>
        </nav>
        {/* The stand-in holds the chip's space so the links do not slide when the balance arrives. */}
        <Suspense fallback={<Skeleton shape="block" className="h-8 w-28" />}>
          <WalletSlot />
        </Suspense>
      </div>
    </header>
  );
}
