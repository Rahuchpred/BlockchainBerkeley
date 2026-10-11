import { percent } from "@/lib/fairseat/data";

export type Share = { team: string; share: number; tone: number };

// Who holds how much of a seat right now: one segment per team, as wide as the team's share.
// Teams without their own color are drawn as one neutral segment.
export function OwnershipBar({
  shares,
  legend = 4,
}: {
  shares: Share[];
  legend?: number;
}) {
  const named = shares.filter((item) => item.tone > 0);
  const rest = shares.filter((item) => item.tone === 0 && item.share > 0);
  const restShare = rest.reduce((sum, item) => sum + item.share, 0);
  const listed = named.slice(0, legend);
  const unlisted = named.length - listed.length + rest.length;
  const unlistedShare =
    named.slice(legend).reduce((sum, item) => sum + item.share, 0) + restShare;
  const summary = named
    .map((item) => `${item.team} ${percent(item.share)}`)
    .join(", ");

  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={`Share of the seat by team: ${summary}`}
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
      >
        {named.map((item) => (
          <span
            key={item.team}
            className="h-full min-w-1 w-(--share) transition-[width] duration-(--dur-slow) ease-out bg-(--tone)"
            style={
              {
                "--share": `${item.share * 100}%`,
                "--tone": `var(--team-${item.tone})`,
              } as React.CSSProperties
            }
          />
        ))}
        {restShare > 0 && (
          <span
            className="h-full min-w-1 w-(--share) transition-[width] duration-(--dur-slow) ease-out bg-(--team-0)"
            style={{ "--share": `${restShare * 100}%` } as React.CSSProperties}
          />
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-2">
        {listed.map((item) => (
          <li key={item.team} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-(--tone)"
              style={
                { "--tone": `var(--team-${item.tone})` } as React.CSSProperties
              }
            />
            {item.team} {percent(item.share)}
          </li>
        ))}
        {unlisted > 0 && (
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-(--team-0)"
            />
            {unlisted} more {percent(unlistedShare)}
          </li>
        )}
      </ul>
    </div>
  );
}
