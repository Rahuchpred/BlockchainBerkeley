import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/lime/ui/button";
import { Card } from "@/components/lime/ui/card";
import { formatAmount } from "@/components/lime/ui/amount";
import { Icon, ArrowLeft } from "@/components/lime/icon";
import {
  EVENTS,
  feeFor,
  formatDate,
  getSeat,
  getSide,
  percent,
  priceFor,
  seatLabel,
} from "@/lib/fairseat/data";
import { findEvent } from "@/lib/fairseat/events";
import { loadSide } from "@/lib/fairseat/live";
import { offerFor, soldTicket, ticketKey } from "@/lib/fairseat/store";
import { readWallet } from "@/lib/fairseat/wallet";
import { PageSkeleton } from "../../../../../../_components/page-skeleton";
import { PayButton } from "../../../../../../_components/pay-button";

export async function generateStaticParams() {
  const all = await Promise.all(
    EVENTS.flatMap((event) =>
      event.seats.map(async (seat) => {
        const config = getSide(event, seat.side);
        const side = config && (await loadSide(config));
        return (side?.onSale ?? []).map((outcome) => ({
          id: event.id,
          seat: seat.id,
          team: outcome.slug,
        }));
      }),
    ),
  );
  return all.flat();
}

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
}: Pick<PageProps<"/events/[id]/seats/[seat]/buy/[team]">, "params">) {
  const { id, seat: seatId, team } = await params;
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
          <h1 className="title-page">Review your ticket</h1>
        </header>
        <Card variant="outline">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
              {formatAmount(price + fee)}
            </p>
            <p className="text-sm leading-normal text-fg-2">
              {resale === null
                ? "The price follows live odds and can change until you pay."
                : "Another fan is reselling this ticket at their own price."}
            </p>
          </div>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Ticket" value={`If ${outcome.team} make the final`} />
            <Row
              label="Event"
              value={`${event.title}, ${formatDate(event.date)}`}
            />
            <Row label="Seat" value={seatLabel(seat)} />
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
          </dl>
          <p className="text-sm leading-normal text-fg-2">
            If {outcome.team} do not make the final, this ticket expires and is
            not refunded. You can resell it at any time before then.
          </p>
          <PayButton
            eventId={event.id}
            seatId={seat.id}
            team={outcome.slug}
            label={`Pay ${formatAmount(price + fee)}`}
            hasWallet={hasWallet}
          />
        </Card>
      </main>
    </>
  );
}

export default function ReviewPage({
  params,
}: PageProps<"/events/[id]/seats/[seat]/buy/[team]">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <ReviewPageContent params={params} />
      </Suspense>
    </>
  );
}
