"use client";

import { useState } from "react";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";

export type ChartPoint = { t: number; v: number };
export type ChartRange = { label: string; points: ChartPoint[] };

const W = 640;
const H = 220;
const PAD = { top: 12, right: 44, bottom: 28, left: 4 };

const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function Plot({
  points,
  tone,
  label,
}: {
  points: ChartPoint[];
  tone: number;
  label: string;
}) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-fg-2">Not enough trades yet to draw this.</p>
    );
  }
  const values = points.map((point) => point.v);
  const low = Math.max(0, Math.floor((Math.min(...values) - 2) / 5) * 5);
  const high = Math.min(100, Math.ceil((Math.max(...values) + 2) / 5) * 5);
  const span = high - low || 1;
  const x = (index: number) =>
    PAD.left + (index * (W - PAD.left - PAD.right)) / (points.length - 1);
  const y = (value: number) =>
    PAD.top + (1 - (value - low) / span) * (H - PAD.top - PAD.bottom);
  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(point.v).toFixed(1)}`,
    )
    .join("");
  const area = `${line}L${x(points.length - 1).toFixed(1)} ${y(low)}L${x(0)} ${y(low)}Z`;
  const ticks = [low, low + span / 2, high];
  const last = points[points.length - 1];
  const first = points[0];

  return (
    <svg
      role="img"
      aria-label={`${label}: ${first.v}% on ${dayFormat.format(first.t)}, ${last.v}% on ${dayFormat.format(last.t)}`}
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      style={
        {
          "--tone": `var(--team-${tone})`,
          "--tone-soft": `var(--team-${tone}-soft)`,
        } as React.CSSProperties
      }
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
      <path d={area} className="fill-(--tone-soft)" />
      <path
        d={line}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-(--tone)"
      />
      <circle
        cx={x(points.length - 1)}
        cy={y(last.v)}
        r={4}
        className="fill-(--tone)"
      />
      <text x={PAD.left} y={H - 6} className="fill-fg-3 text-xs">
        {dayFormat.format(first.t)}
      </text>
      <text
        x={W - PAD.right}
        y={H - 6}
        textAnchor="end"
        className="fill-fg-3 text-xs"
      >
        {dayFormat.format(last.t)}
      </text>
    </svg>
  );
}

// A team's chance over time, drawn by hand so no chart library is needed. One line in the team's color.
export function OddsChart({
  ranges,
  tone,
  label,
}: {
  ranges: ChartRange[];
  tone: number;
  label: string;
}) {
  const [range, setRange] = useState(ranges[0]?.label ?? "");
  const shown = ranges.find((item) => item.label === range) ?? ranges[0];
  if (!shown) return null;

  return (
    <div className="flex flex-col gap-3">
      <Plot points={shown.points} tone={tone} label={label} />
      {ranges.length > 1 && (
        <Segmented
          value={range}
          onValueChange={setRange}
          size="sm"
          aria-label="Time range"
        >
          {ranges.map((item) => (
            <SegmentedItem key={item.label} value={item.label}>
              {item.label}
            </SegmentedItem>
          ))}
        </Segmented>
      )}
    </div>
  );
}
