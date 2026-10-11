import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/lime/ui/button";
import { Card } from "@/components/lime/ui/card";
import { formatAmount } from "@/components/lime/ui/amount";
import { Icon, ArrowLeft } from "@/components/lime/icon";
import {
  feeFor,
  formatDate,
  getSeat,
  getSide,
  groupOf,
  percent,
  priceFor,
  seatLabel,
  seatsBeside,
} from "@/lib/fairseat/data";
import { findEvent } from "@/lib/fairseat/events";
import { loadSide } from "@/lib/fairseat/live";
import { TICKET_LIMIT } from "@/lib/fairseat/rules";
import { offerFor, soldTicket, ticketKey } from "@/lib/fairseat/store";
import { readWallet } from "@/lib/fairseat/wallet";
import { GROUP_LIMIT } from "@/lib/fairseat/xrpl";
import { PageSkeleton } from "../../../../../../_components/page-skeleton";
import { PayButton } from "../../../../../../_components/pay-button";
import { SeatCount } from "../../../../../../_components/seat-count";

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-2">{label}</dt>
      <dd className={mono ? "text-end font-mono tabular-nums" : "text-end"}>
        {value}
      </dd>
    </div>
  );
}

async function ReviewPageContent({
  params,
  searchParams,
}: PageProps<"/events/[id]/seats/[seat]/buy/[team]">) {
  const { id, seat: seatId, team } = await params;
  const { seats: asked } = await searchParams;
  const event = findEvent(id);
  const seat = event && getSeat(event, seatId);
  const config = event && seat && getSide(event, seat.side);
  if (!event || !seat || !config) notFound();
  const side = await loadSide(config);
  const outcome = side.onSale.find((item) => item.slug === team);
  if (!outcome) notFound();

  // A ticket that was already sold can only be bought from its holder, at the price they listed.
  const taken = soldTicket(ticketKey(event.id, seat.id, outcome.slug));
  const offer = taken ? offerFor(taken) : null;
  const resale = offer && offer.price > 0 ? offer.price : null;
  const price = resale ?? priceFor(seat, outcome.share);
  const hasWallet = (await readWallet()) !== null;
  const fee = resale === null ? feeFor(price) : 0;
  const back = `/events/${event.id}/seats/${seat.id}`;

  // Seats beside this one, in its row, can be paid for together while this team's ticket for each
  // is unsold. A ticket that was sold once is bought on its own.
  const run = taken
    ? [seat]
    : seatsBeside(
        event,
        seat,
        (item) => !soldTicket(ticketKey(event.id, item.id, outcome.slug)),
      );
  const most = Math.min(run.length, GROUP_LIMIT);
  const count = Math.min(Math.max(Math.trunc(Number(asked)) || 1, 1), most);
  const group = groupOf(run, seat, count);
  const each = price + fee;
  const total = Math.round(each * count * 100) / 100;
  const many = count > 1;

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
        <header className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to the seat"
            nativeButton={false}
            render={<Link href={back} />}
            icon={<Icon icon={ArrowLeft} size={20} />}
          />
          <h1 className="title-page">
            {many ? "Review your tickets" : "Review your ticket"}
          </h1>
        </header>
        <Card variant="outline">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
              {formatAmount(total)}
            </p>
            <p className="text-sm leading-normal text-fg-2">
              {resale === null
                ? "The price follows live odds and can change until you pay."
                : "Another fan is reselling this ticket at their own price."}
            </p>
          </div>
          {most > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Seats together</p>
              <SeatCount value={count} max={most} />
            </div>
          )}
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Ticket" value={`If ${outcome.team} make the final`} />
            <Row
              label="Event"
              value={`${event.title}, ${formatDate(event.date)}`}
            />
            <Row
              label={many ? "Seats" : "Seat"}
              value={
                many
                  ? `Section ${seat.section}, row ${seat.row}, seats ${group[0].seat} to ${group[count - 1].seat}`
                  : seatLabel(seat)
              }
            />
            <Row
              label="Full seat price"
              value={formatAmount(seat.faceValue)}
              mono
            />
            <Row
              label="Share of the seat"
              value={percent(outcome.share)}
              mono
            />
            <Row label="Ticket price" value={formatAmount(price)} mono />
            {resale === null && (
              <Row label="Fee" value={formatAmount(fee)} mono />
            )}
            {many && (
              <div className="flex flex-col gap-2 border-t border-line pt-2">
                {group.map((item) => (
                  <Row
                    key={item.id}
                    label={`Seat ${item.seat}`}
                    value={formatAmount(each)}
                    mono
                  />
                ))}
                <div className="flex justify-between gap-3 border-t border-line pt-2 font-medium">
                  <dt>Total</dt>
                  <dd className="font-mono tabular-nums">
                    {formatAmount(total)}
                  </dd>
                </div>
              </div>
            )}
          </dl>
          <p className="text-sm leading-normal text-fg-2">
            {many
              ? `If ${outcome.team} do not make the final, these tickets expire and are not refunded. You can resell each one at any time before then. You pay for all ${count} at once: you get every ticket or none.`
              : `If ${outcome.team} do not make the final, this ticket expires and is not refunded. You can resell it at any time before then.`}
            {resale === null &&
              " Your payment is held in escrow on the XRP Ledger and released to the organizer once the finalists are decided."}
          </p>
          <p className="text-sm leading-normal text-fg-2">
            {`One wallet can hold up to ${TICKET_LIMIT} ${outcome.team} tickets for this event.`}
          </p>
          <PayButton
            eventId={event.id}
            seatIds={group.map((item) => item.id)}
            team={outcome.slug}
            label={`Pay ${formatAmount(total)}`}
            hasWallet={hasWallet}
          />
        </Card>
      </main>
    </>
  );
}

export default function ReviewPage({
  params,
  searchParams,
}: PageProps<"/events/[id]/seats/[seat]/buy/[team]">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <ReviewPageContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
