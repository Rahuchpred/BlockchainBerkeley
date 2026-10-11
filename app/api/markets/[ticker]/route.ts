import { EVENTS, slug } from "@/lib/fairseat/data";
import { getMarket } from "@/lib/fairseat/gemini";

const TICKERS = new Set(
  EVENTS.flatMap((event) => event.sides.map((side) => side.market)),
);

// The live shares for one market, for pages that keep their prices fresh after loading.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/markets/[ticker]">,
) {
  const { ticker } = await params;
  if (!TICKERS.has(ticker))
    return Response.json({ error: "Unknown market" }, { status: 404 });
  const market = await getMarket(ticker);
  return Response.json({
    settled: market.settled,
    shares: Object.fromEntries(
      market.outcomes.map((outcome) => [slug(outcome.team), outcome.share]),
    ),
  });
}
