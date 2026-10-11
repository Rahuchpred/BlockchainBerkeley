import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatAmount } from "@/components/lime/ui/amount";
import { Button } from "@/components/lime/ui/button";
import { Card } from "@/components/lime/ui/card";
import {
  Empty,
  EmptyActions,
  EmptyDescription,
  EmptyTitle,
} from "@/components/lime/ui/empty";
import { Status } from "@/components/lime/ui/status";
import {
  accountRole,
  explorerAccountUrl,
  readAccount,
} from "@/lib/fairseat/xrpl";
import { PageSkeleton } from "../../../_components/page-skeleton";
import { ExplorerLink, Facts } from "../../../_components/proof-parts";
import { Stat } from "../../../_components/stat";

const HEADLINES = {
  organizer: "The organizer's account",
  issuer: "The test dollar issuer's account",
  fan: "A fan's account",
};

const count = (amount: number, one: string, many: string) =>
  `${amount} ${amount === 1 ? one : many}`;

function Missing() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <Empty>
        <EmptyTitle>No account found</EmptyTitle>
        <EmptyDescription>
          The XRP Ledger testnet has no account with this address, or it could
          not be reached. Check the link and try again.
        </EmptyDescription>
        <EmptyActions>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/events" />}
          >
            Browse events
          </Button>
        </EmptyActions>
      </Empty>
    </main>
  );
}

async function AccountPageContent({
  params,
}: Pick<PageProps<"/proof/account/[address]">, "params">) {
  const { address } = await params;
  await connection();
  const account = await readAccount(address);
  if (!account) return <Missing />;
  const { lockedByIt, lockedForIt } = account;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="title-page">{HEADLINES[accountRole(address)]}</h1>
        <Status status="done" label="Found on the XRP Ledger testnet" />
        <p className="text-base leading-normal text-fg-2">
          What this account holds right now. Read live from the XRP Ledger
          testnet when this page opened.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Stat
          label="Test dollars"
          value={formatAmount(account.dollars)}
          note="What it can spend"
        />
        <Stat
          label="Tickets"
          value={String(account.nfts)}
          note="Each one is an NFT in this account"
        />
        <Stat
          label="Locked by this account"
          value={formatAmount(lockedByIt.dollars)}
          note={`${count(lockedByIt.count, "payment", "payments")} held in escrow for someone else`}
        />
        <Stat
          label="Locked for this account"
          value={formatAmount(lockedForIt.dollars)}
          note={`${count(lockedForIt.count, "payment", "payments")} held in escrow until each result is decided`}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Details</h2>
        <Card variant="surface">
          <Facts
            facts={[
              {
                label: "Address",
                value: <span className="font-mono">{account.address}</span>,
              },
              {
                label: "XRP, which pays the ledger's fees",
                value: <span className="font-mono">{account.xrp} XRP</span>,
              },
              {
                label: "Test dollars",
                value: (
                  <span className="font-mono">
                    {account.dollars.toFixed(2)} USD
                  </span>
                ),
              },
              {
                label: "NFTs held",
                value: <span className="font-mono">{account.nfts}</span>,
              },
              {
                label: "Escrows it is part of",
                value: (
                  <span className="font-mono">
                    {lockedByIt.count + lockedForIt.count}
                  </span>
                ),
              },
            ]}
          />
        </Card>
        <ExplorerLink href={explorerAccountUrl(account.address)} />
      </section>
    </main>
  );
}

export default function AccountPage({
  params,
}: PageProps<"/proof/account/[address]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountPageContent params={params} />
    </Suspense>
  );
}
