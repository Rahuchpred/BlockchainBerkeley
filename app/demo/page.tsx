import { connection } from "next/server";
import { Suspense } from "react";
import { allEvents } from "@/lib/fairseat/events";
import { getMarket } from "@/lib/fairseat/gemini";
import { stagedResult } from "@/lib/fairseat/store";
import { PageSkeleton } from "../_components/page-skeleton";
import {
  SettleControls,
  type SettleSide,
} from "../_components/settle-controls";

async function DemoContent() {
  await connection();
  // Two events can share a market, and a market settles once for both.
  const seen = new Set<string>();
  const sides = await Promise.all(
    allEvents().flatMap((event) =>
      event.sides
        .filter((side) => !seen.has(side.market) && seen.add(side.market))
        .map(async (side): Promise<SettleSide> => {
          const market = await getMarket(side.market);
          return {
            market: side.market,
            event: event.title,
            name: side.name,
            teams: market.outcomes
              .filter((outcome) => !outcome.eliminated && outcome.share > 0)
              .map((outcome) => outcome.team),
            staged: market.settled ?? stagedResult(side.market),
            final: market.settled !== null,
          };
        }),
    ),
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="title-page">Demo controls</h1>
        <p className="max-w-xl text-base leading-normal text-fg-2">
          The real markets settle months from now. This page stands in for that
          day: pick the team that makes the final and every ticket for that side
          turns into the seat or expires. Undo puts the live odds back.
        </p>
      </header>
      <SettleControls sides={sides} />
    </main>
  );
}

export default function DemoPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DemoContent />
    </Suspense>
  );
}
