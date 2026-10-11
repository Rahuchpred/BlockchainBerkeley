import { Card, CardTitle } from "@/components/lime/ui/card";
import type { WatchedMarket } from "@/lib/fairseat/live";
import { LiveValue } from "./live";
import { OwnershipBar } from "./ownership-bar";
import { TeamMark } from "./team-mark";

/** How many teams a card names. The bar under them covers every priced team. */
const NAMED = 3;

// Gemini sports markets with live odds that Fairseat sells no tickets on, each with the reason why.
// Nothing here can be bought, so the cards are not links.
export function WatchList({ markets }: { markets: WatchedMarket[] }) {
  if (markets.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Markets we are watching</h2>
        <p className="max-w-xl text-sm leading-normal text-fg-2">
          Live odds from Gemini for markets that cannot price a seat yet. Each
          one says why tickets are not open.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {markets.map((market) => (
          <li key={market.ticker} className="flex">
            <Card variant="outline" className="w-full">
              <CardTitle>{market.title}</CardTitle>
              {market.outcomes.length > 0 && (
                <>
                  <ul className="flex flex-col gap-2">
                    {market.outcomes.slice(0, NAMED).map((outcome) => (
                      <li
                        key={outcome.slug}
                        className="flex items-center gap-2 text-sm"
                      >
                        <TeamMark
                          team={outcome.team}
                          image={outcome.image}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {outcome.team}
                        </span>
                        <span className="text-fg-2 tabular-nums">
                          <LiveValue kind="percent" value={outcome.chance} />
                        </span>
                      </li>
                    ))}
                  </ul>
                  <OwnershipBar
                    shares={market.outcomes}
                    legend={0}
                    label="Each team's part of the market"
                  />
                </>
              )}
              <p className="text-sm text-fg-2">{market.reason}</p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
