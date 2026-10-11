import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TeamMark } from "../../_components/team-mark";
import { Button } from "@/components/lime/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/lime/ui/card";
import { formatAmount } from "@/components/lime/ui/amount";
import { Icon, ArrowLeft } from "@/components/lime/icon";
import { formatDate, getEvent, percent, seatLabel } from "@/lib/fairseat/data";
import { getHistory } from "@/lib/fairseat/gemini";
import { viewTicket } from "@/lib/fairseat/live";
import { readWallet } from "@/lib/fairseat/wallet";
import { offerFor, paidFor } from "@/lib/fairseat/store";
import { RESALE_RATE, listTickets, txUrl } from "@/lib/fairseat/xrpl";
import { Status } from "@/components/lime/ui/status";
import { qrShape } from "@/lib/fairseat/qr";
import { OddsChart } from "../../_components/odds-chart";
import { PageSkeleton } from "../../_components/page-skeleton";
import { QrCode } from "../../_components/qr-code";
import { TicketActions } from "../../_components/ticket-actions";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-2">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}

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
  const view = await viewTicket(ticket, getEvent(ticket.eventId));
  if (!view) notFound();
  const gift = typeof claimed === "string";
  const receipt = typeof bought === "string" ? bought : gift ? claimed : null;
  const open = offerFor(ticket.id);
  const offer = open ? { offerId: open.offerId, price: open.price } : null;

  const { event, seat, outcome, status, worth } = view;
  const gain = worth - ticket.paid;
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
    <>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
        <header className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to my tickets"
            nativeButton={false}
            render={<Link href="/tickets" />}
            icon={<Icon icon={ArrowLeft} size={20} />}
          />
          <TeamMark image={outcome.image} team={outcome.team} size="lg" />
          <div className="flex flex-col gap-1">
            <h1 className="title-page">{`If ${outcome.team} make the final`}</h1>
            <p className="text-base text-fg-2">
              {event.title}, {formatDate(event.date)} at {event.venue}.
            </p>
            <p className="font-mono text-base text-fg-2">{seatLabel(seat)}</p>
          </div>
        </header>

        {receipt && (
          <section className="flex flex-col gap-3 transition-[opacity,transform] duration-(--dur-slow) ease-out starting:translate-y-2 starting:opacity-0">
            <h2 className="text-lg font-semibold">
              {gift ? "Ticket claimed" : "Payment done"}
            </h2>
            <Status
              status="done"
              label={
                gift
                  ? "Moved to your wallet on the XRP Ledger"
                  : `Paid ${formatAmount(ticket.paid)} on the XRP Ledger`
              }
            />
            <p className="text-sm leading-normal text-fg-2">
              {gift
                ? "The ticket now sits in your wallet, and only you can sell or send it."
                : "The ticket and the payment changed hands in one transaction, so neither could happen without the other."}
            </p>
            <div>
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
          </section>
        )}

        {status === "live" && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Your seat</h2>
            <p className="text-sm leading-normal text-fg-2">
              {outcome.team} made the final, so this ticket is now the seat.
              Show this code at the gate.
            </p>
            <QrCode
              shape={qrShape(`fairseat:${ticket.id}`)}
              label={`Gate code for ${seatLabel(seat)}`}
              className="size-48 rounded-md"
            />
          </section>
        )}

        {status === "expired" && (
          <p className="text-base leading-normal text-fg-2">
            {outcome.team} did not make the final, so this ticket has expired.
            The seat went to the fan holding the ticket for the team that did.
          </p>
        )}

        {status === "open" && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Worth now</h2>
            <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
              {formatAmount(worth)}
            </p>
            <p className="text-sm leading-normal text-fg-2">
              {outcome.team} hold {percent(outcome.share)} of this seat. The
              line is the market&apos;s price for them making the final.
            </p>
            <OddsChart
              tone={outcome.tone}
              label={`${outcome.team}'s chance of making the final`}
              ranges={ranges}
            />
          </section>
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

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Your position</h2>
          <Card variant="surface">
            <div className="flex flex-col gap-1">
              <CardTitle>What you paid and what it is worth</CardTitle>
              <CardDescription>
                The full seat price is {formatAmount(seat.faceValue)}.
              </CardDescription>
            </div>
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="You paid" value={formatAmount(ticket.paid)} />
              <Row label="Worth now" value={formatAmount(worth)} />
              <Row
                label="Gain or loss"
                value={formatAmount(gain, { signed: true })}
              />
            </dl>
          </Card>
        </section>
      </main>
    </>
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
