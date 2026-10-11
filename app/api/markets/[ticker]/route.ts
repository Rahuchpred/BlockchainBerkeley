import { MARKETS, NBA_CONFERENCES, slug } from "@/lib/fairseat/data";
import { getMarket } from "@/lib/fairseat/gemini";

// The live shares for one market, for pages that keep their prices fresh after loading.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/markets/[ticker]">,
) {
  const { ticker } = await params;
  if (!(ticker in MARKETS) && !(ticker in NBA_CONFERENCES))
    return Response.json({ error: "Unknown market" }, { status: 404 });
  const market = await getMarket(ticker);
  return Response.json({
    settled: market.settled,
    shares: Object.fromEntries(
      market.outcomes.map((outcome) => [slug(outcome.team), outcome.share]),
    ),
  });
}
