import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/lime/ui/button";
import {
  Empty,
  EmptyActions,
  EmptyDescription,
  EmptyTitle,
} from "@/components/lime/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/lime/ui/table";
import { formatAmount } from "@/components/lime/ui/amount";
import { seatLabel } from "@/lib/fairseat/data";
import { findEvent } from "@/lib/fairseat/events";
import {
  allActivity,
  pendingEscrows,
  type Activity,
} from "@/lib/fairseat/store";
import { formatTime, shortAddress } from "@/lib/fairseat/story";
import { readWallet } from "@/lib/fairseat/wallet";
import {
  RESALE_RATE,
  accountUrl,
  getBalance,
  txUrl,
} from "@/lib/fairseat/xrpl";
import { PageSkeleton } from "../_components/page-skeleton";
import { Stat } from "../_components/stat";
import { WalletChip } from "../_components/wallet-chip";

/** What a step did to this wallet's dollars, and what to call it from the holder's side. */
function line(step: Activity, me: string): { what: string; change: number } {
  const amount = step.amount ?? 0;
  switch (step.kind) {
    case "bought":
      return { what: "Bought a ticket, paid into escrow", change: -amount };
    case "resold":
      return step.from === me
        ? { what: "Bought a resale ticket", change: -amount }
        : { what: "Sold a ticket", change: amount * (1 - RESALE_RATE) };
    case "listed":
      return { what: `Listed for ${formatAmount(amount)}`, change: 0 };
    case "unlisted":
      return { what: "Took a ticket off sale", change: 0 };
    case "sent":
      return { what: "Sent a ticket as a gift", change: 0 };
    case "claimed":
      return step.to === me
        ? { what: "Claimed a ticket from a friend", change: 0 }
        : { what: "A friend claimed your ticket", change: 0 };
    case "released":
      return { what: "Escrow released to the organizer", change: 0 };
    case "burned":
      return { what: "Ticket expired", change: 0 };
    default:
      return { what: "Ticket created", change: 0 };
  }
}

async function WalletContent() {
  await connection();
  const wallet = await readWallet();
  if (!wallet) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
        <h1 className="title-page">Wallet</h1>
        <Empty>
          <EmptyTitle>No wallet yet</EmptyTitle>
          <EmptyDescription>
            A test wallet lives on the XRP Ledger testnet and comes with $5,000
            in test dollars to buy with.
          </EmptyDescription>
          <EmptyActions>
            <WalletChip balance={null} />
          </EmptyActions>
        </Empty>
      </main>
    );
  }

  const balance = await getBalance(wallet.address).catch(() => Number.NaN);
  const locked = Object.values(pendingEscrows())
    .filter((escrow) => escrow.owner === wallet.address)
    .reduce((sum, escrow) => sum + escrow.amount, 0);
  const steps = allActivity()
    .filter(
      (step) =>
        step.kind !== "minted" &&
        (step.from === wallet.address || step.to === wallet.address),
    )
    .reverse();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="title-page">Wallet</h1>
        <p className="font-mono text-sm text-fg-2">
          {shortAddress(wallet.address)}, on the XRP Ledger testnet
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat
          label="Available to spend"
          value={
            Number.isFinite(balance) ? formatAmount(balance) : "Unavailable"
          }
          note="Test dollars in your wallet"
        />
        <Stat
          label="Locked in escrow"
          value={formatAmount(locked)}
          note="Released to the organizer once the finalists are decided"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button nativeButton={false} render={<Link href="/tickets" />}>
          See my tickets
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <a
              href={accountUrl(wallet.address)}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          View the account on the ledger
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Activity</h2>
        {steps.length === 0 ? (
          <p className="text-sm leading-normal text-fg-2">
            Nothing yet. Buying, selling and sending tickets will show up here.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>What happened</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead className="text-end">Dollars</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Proof</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step) => {
                const { what, change } = line(step, wallet.address);
                const event = findEvent(step.eventId);
                const seat = event?.seats.find(
                  (item) => item.id === step.seatId,
                );
                return (
                  <TableRow key={`${step.at}-${step.kind}-${step.nftId}`}>
                    <TableCell className="whitespace-nowrap">{what}</TableCell>
                    <TableCell className="whitespace-nowrap text-fg-2">
                      {seat ? seatLabel(seat) : step.seatId}
                    </TableCell>
                    <TableCell className="text-end font-mono tabular-nums">
                      {change === 0
                        ? ""
                        : formatAmount(change, { signed: true })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-fg-2">
                      {formatTime(step.at)}
                    </TableCell>
                    <TableCell>
                      {step.hash && (
                        <Button
                          variant="link"
                          size="sm"
                          nativeButton={false}
                          render={
                            <a
                              href={txUrl(step.hash)}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          Transaction
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WalletContent />
    </Suspense>
  );
}
