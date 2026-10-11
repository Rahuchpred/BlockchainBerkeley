import { connection } from "next/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/lime/ui/card";
import { conditionOf, formatDate, seatLabel } from "@/lib/fairseat/data";
import { findEvent } from "@/lib/fairseat/events";
import { viewTicket } from "@/lib/fairseat/live";
import { findOffer } from "@/lib/fairseat/store";
import { readWallet } from "@/lib/fairseat/wallet";
import { ClaimButton } from "../../_components/claim-button";
import { PageSkeleton } from "../../_components/page-skeleton";
import { TeamMark } from "../../_components/team-mark";

async function ClaimPageContent({
  params,
}: Pick<PageProps<"/claim/[offer]">, "params">) {
  const { offer: offerId } = await params;
  await connection();
  const offer = findOffer(offerId);
  if (!offer || offer.price !== 0) notFound();
  const view = await viewTicket(
    {
      id: offer.nftId,
      eventId: offer.eventId,
      seatId: offer.seatId,
      team: offer.team,
      paid: 0,
    },
    findEvent(offer.eventId),
  );
  if (!view) notFound();
  const hasWallet = (await readWallet()) !== null;
  const { event, seat, outcome } = view;
  const condition = conditionOf(view.side);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <h1 className="title-page">A ticket for you</h1>
      <Card variant="outline">
        <div className="flex items-center gap-3">
          <TeamMark image={outcome.image} team={outcome.team} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{`If ${outcome.team} ${condition.make}`}</CardTitle>
            <CardDescription>
              {event.title}, {formatDate(event.date)}
            </CardDescription>
            <CardDescription className="tabular-nums">
              {seatLabel(seat)}
            </CardDescription>
          </div>
        </div>
        <p className="text-sm leading-normal text-fg-2">
          {`A friend sent you this ticket. It becomes the seat if ${outcome.team} ${condition.make}, and expires if they do not.`}
        </p>
        <ClaimButton offerId={offerId} hasWallet={hasWallet} />
      </Card>
    </main>
  );
}

export default function ClaimPage({ params }: PageProps<"/claim/[offer]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClaimPageContent params={params} />
    </Suspense>
  );
}
