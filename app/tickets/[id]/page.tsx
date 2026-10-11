import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/lime/ui/button";
import { formatAmount } from "@/components/lime/ui/amount";
import { Icon, ArrowLeft } from "@/components/lime/icon";
import { formatDate, percent, placeOf } from "@/lib/fairseat/data";
import { findEvent } from "@/lib/fairseat/events";
import { getHistory } from "@/lib/fairseat/gemini";
import { viewTicket } from "@/lib/fairseat/live";
import { readWallet } from "@/lib/fairseat/wallet";
import {
  activityFor,
  escrowFor,
  offerFor,
  paidFor,
} from "@/lib/fairseat/store";
import { RESALE_RATE, listTickets, txUrl } from "@/lib/fairseat/xrpl";
import { Status } from "@/components/lime/ui/status";
import { qrShape } from "@/lib/fairseat/qr";
import { OddsChart } from "../../_components/odds-chart";
import { PageSkeleton } from "../../_components/page-skeleton";
import { LedgerTrail } from "../../_components/ledger-trail";
import { TicketActions } from "../../_components/ticket-actions";
import { TicketPass } from "../../_components/ticket-pass";

async function TicketPageContent({
  params,
  searchParams,
}: PageProps<"/tickets/[id]">) {
  const { id } = await params;
  await connection();
  const { bought, claimed } = await searchParams;
  const wallet = await readWallet();
  const held = wallet ? await listTickets(wallet.address) : [];
  const record = held.find((item) => item.nftId === id);
  if (!record) notFound();
  const ticket = {
    id: record.nftId,
    eventId: record.eventId,
    seatId: record.seatId,
    team: record.team,
    // A ticket bought from another fan or received as a gift cost its holder something else than the first sale.
    paid: paidFor(record.nftId) ?? record.paid,
  };
  const view = await viewTicket(ticket, findEvent(ticket.eventId));
  if (!view) notFound();
  const gift = typeof claimed === "string";
  const receipt = typeof bought === "string" ? bought : gift ? claimed : null;
  // The payment for this ticket, if this wallet made it and it is still locked on the ledger.
  const escrow = escrowFor(ticket.id);
  const locked = escrow && escrow.owner === wallet?.address ? escrow : null;
  const open = offerFor(ticket.id);
  const offer = open ? { offerId: open.offerId, price: open.price } : null;

  const { event, seat, outcome, status, worth } = view;
  const [hours, days] =
    status === "open"
      ? await Promise.all([
          getHistory(outcome.symbol, "6hr"),
          getHistory(outcome.symbol, "1day"),
        ])
      : [[], []];
  const ranges = [
    { label: "1W", points: hours.slice(-28) },
    { label: "1M", points: days.slice(-30) },
    { label: "All", points: days },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-4 pb-8 sm:px-6 sm:pt-6">
      <header className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to my tickets"
          nativeButton={false}
          render={<Link href="/tickets" />}
          icon={<Icon icon={ArrowLeft} size={20} />}
        />
        <h1 className="title-page">Your ticket</h1>
        {receipt && (
          <div className="ms-auto flex flex-wrap items-center gap-3 transition-opacity duration-(--dur-slow) ease-out starting:opacity-0">
            <Status
              status="done"
              label={
                gift
                  ? "Claimed on the XRP Ledger"
                  : `Paid ${formatAmount(ticket.paid)}${locked ? " into escrow" : ""}`
              }
            />
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={txUrl(receipt)} target="_blank" rel="noreferrer" />
              }
            >
              View the transaction
            </Button>
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <TicketPass
            team={outcome.team}
            image={outcome.image}
            tone={outcome.tone}
            event={event.title}
            when={formatDate(event.date)}
            place={placeOf(event)}
            section={seat.section}
            row={seat.row}
            seat={seat.seat}
            status={status}
            paid={ticket.paid}
            worth={worth}
            locked={locked?.amount ?? null}
            qr={
              status === "live" ? qrShape(`fairseat:${ticket.id}`) : undefined
            }
            code={`${ticket.id.slice(0, 8)}...${ticket.id.slice(-8)}`}
          />
          {status === "expired" && (
            <p className="text-sm leading-normal text-fg-2">
              {outcome.team} did not make the final, so this ticket has expired.
            </p>
          )}
          {status === "open" && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Sell or send</h2>
              <TicketActions
                nftId={ticket.id}
                worth={worth}
                cut={RESALE_RATE}
                offer={offer}
              />
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {status === "open" && (
            <section className="flex flex-col gap-3 rounded-panel bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">{`${outcome.team}'s chance`}</h2>
                <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
                  {percent(outcome.chance)}
                </p>
              </div>
              <OddsChart
                tone={outcome.tone}
                label={`${outcome.team}'s chance of making the final`}
                ranges={ranges}
              />
            </section>
          )}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">On the ledger</h2>
            <LedgerTrail steps={activityFor(ticket.id)} />
          </section>
        </div>
      </div>
    </main>
  );
}

export default function TicketPage({
  params,
  searchParams,
}: PageProps<"/tickets/[id]">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <TicketPageContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
