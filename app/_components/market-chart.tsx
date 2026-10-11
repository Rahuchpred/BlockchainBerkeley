import type { ChartPoint } from "./odds-chart";

export type MarketLine = {
  team: string;
  tone: number;
  points: ChartPoint[];
};

const W = 640;
const H = 260;
const PAD = { top: 12, right: 44, bottom: 28, left: 4 };

const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// Several teams' chances over the same days, one line each in the team's color.
export function MarketChart({
  lines,
  label,
}: {
  lines: MarketLine[];
  label: string;
}) {
  const drawn = lines.filter((line) => line.points.length > 1);
  if (drawn.length === 0) {
    return (
      <p className="text-sm text-fg-2">Not enough trades yet to draw this.</p>
    );
  }
  const from = Math.min(...drawn.map((line) => line.points[0].t));
  const to = Math.max(
    ...drawn.map((line) => line.points[line.points.length - 1].t),
  );
  const values = drawn.flatMap((line) => line.points.map((point) => point.v));
  const low = Math.max(0, Math.floor((Math.min(...values) - 2) / 5) * 5);
  const high = Math.min(100, Math.ceil((Math.max(...values) + 2) / 5) * 5);
  const span = high - low || 1;
  const x = (t: number) =>
    PAD.left + ((t - from) / (to - from || 1)) * (W - PAD.left - PAD.right);
  const y = (value: number) =>
    PAD.top + (1 - (value - low) / span) * (H - PAD.top - PAD.bottom);
  const ticks = [low, low + span / 2, high];

  return (
    <div className="flex flex-col gap-3">
      <svg
        role="img"
        aria-label={`${label}: ${drawn
          .map(
            (line) => `${line.team} ${line.points[line.points.length - 1].v}%`,
          )
          .join(", ")}`}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-line"
              strokeWidth={1}
            />
            <text
              x={W - PAD.right + 8}
              y={y(tick)}
              dominantBaseline="middle"
              className="fill-fg-3 text-xs"
            >
              {Math.round(tick)}%
            </text>
          </g>
        ))}
        {drawn.map((line) => {
          const last = line.points[line.points.length - 1];
          return (
            <g
              key={line.team}
              style={
                { "--tone": `var(--team-${line.tone})` } as React.CSSProperties
              }
            >
              <path
                d={line.points
                  .map(
                    (point, index) =>
                      `${index === 0 ? "M" : "L"}${x(point.t).toFixed(1)} ${y(point.v).toFixed(1)}`,
                  )
                  .join("")}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="stroke-(--tone)"
              />
              <circle
                cx={x(last.t)}
                cy={y(last.v)}
                r={3.5}
                className="fill-(--tone)"
              />
            </g>
          );
        })}
        <text x={PAD.left} y={H - 6} className="fill-fg-3 text-xs">
          {dayFormat.format(from)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          textAnchor="end"
          className="fill-fg-3 text-xs"
        >
          {dayFormat.format(to)}
        </text>
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {drawn.map((line) => (
          <li
            key={line.team}
            className="flex items-center gap-2 text-sm text-fg-2"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-(--tone)"
              style={
                { "--tone": `var(--team-${line.tone})` } as React.CSSProperties
              }
            />
            {line.team}
          </li>
        ))}
      </ul>
    </div>
  );
}
