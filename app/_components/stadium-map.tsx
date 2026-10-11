"use client";

import { formatAmount } from "@/components/lime/ui/amount";
import { cn } from "@/lib/lime/utils";
import type { VenueMap } from "@/lib/fairseat/data";

export type SectionInfo = { from: number | null; seats: number };

const W = 640;
const H = 470;
const CX = W / 2;
const CY = H / 2;
/** The inner edge of the first ring, and how deep each ring is. */
const INNER = { x: 138, y: 84 };
const DEPTH = { x: 54, y: 44 };
const RING_GAP = 8;
const WEDGE_GAP = 0.9;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const at = (rx: number, ry: number, angle: number) =>
  `${(CX + rx * Math.cos(rad(angle))).toFixed(1)} ${(CY + ry * Math.sin(rad(angle))).toFixed(1)}`;

function wedge(ring: number, rings: number, index: number, count: number) {
  // A lone ring is drawn deeper so the bowl still fills the frame.
  const depth = rings === 1 ? { x: DEPTH.x * 1.7, y: DEPTH.y * 1.7 } : DEPTH;
  const inner = {
    x: INNER.x + ring * (depth.x + RING_GAP),
    y: INNER.y + ring * (depth.y + RING_GAP),
  };
  const outer = { x: inner.x + depth.x, y: inner.y + depth.y };
  const step = 360 / count;
  const from = -90 + index * step + WEDGE_GAP / 2;
  const to = -90 + (index + 1) * step - WEDGE_GAP / 2;
  const middle = (from + to) / 2;
  return {
    path: `M${at(outer.x, outer.y, from)}A${outer.x} ${outer.y} 0 0 1 ${at(outer.x, outer.y, to)}L${at(inner.x, inner.y, to)}A${inner.x} ${inner.y} 0 0 0 ${at(inner.x, inner.y, from)}Z`,
    // The price tag sits one ring further out than its section, so the section itself stays visible.
    tag: {
      x: CX + (outer.x + depth.x / 2 + RING_GAP) * Math.cos(rad(middle)),
      y: CY + (outer.y + depth.y / 2 + RING_GAP) * Math.sin(rad(middle)),
    },
  };
}

function Field({ kind }: { kind: VenueMap["field"] }) {
  if (kind === "baseball") {
    return (
      <g>
        <path
          d={`M${CX} ${CY + 62}L${CX - 96} ${CY - 22}A128 128 0 0 1 ${CX + 96} ${CY - 22}Z`}
          className="fill-success-tint stroke-line-strong"
          strokeWidth={1}
        />
        <path
          d={`M${CX} ${CY + 50}l-30 -30l30 -30l30 30Z`}
          className="fill-surface stroke-line-strong"
          strokeWidth={1}
        />
      </g>
    );
  }
  if (kind === "basketball") {
    return (
      <g className="fill-none stroke-line-strong" strokeWidth={1}>
        <rect
          x={CX - 104}
          y={CY - 56}
          width={208}
          height={112}
          rx={6}
          className="fill-warn-tint"
        />
        <line x1={CX} x2={CX} y1={CY - 56} y2={CY + 56} />
        <circle cx={CX} cy={CY} r={16} />
        {/* Each end: the three-point line and the lane under the basket. */}
        <path
          d={`M${CX - 104} ${CY - 46}h16A46 46 0 0 1 ${CX - 88} ${CY + 46}h-16`}
        />
        <rect x={CX - 104} y={CY - 16} width={40} height={32} />
        <path
          d={`M${CX + 104} ${CY - 46}h-16A46 46 0 0 0 ${CX + 88} ${CY + 46}h16`}
        />
        <rect x={CX + 64} y={CY - 16} width={40} height={32} />
      </g>
    );
  }
  if (kind === "soccer") {
    return (
      <g className="fill-none stroke-line-strong" strokeWidth={1}>
        <rect
          x={CX - 104}
          y={CY - 60}
          width={208}
          height={120}
          rx={2}
          className="fill-success-tint"
        />
        <line x1={CX} x2={CX} y1={CY - 60} y2={CY + 60} />
        <circle cx={CX} cy={CY} r={18} />
        {/* The penalty area and the goal area at each end. */}
        {[-1, 1].map((end) => (
          <g key={end}>
            <rect
              x={end < 0 ? CX - 104 : CX + 72}
              y={CY - 36}
              width={32}
              height={72}
            />
            <rect
              x={end < 0 ? CX - 104 : CX + 92}
              y={CY - 16}
              width={12}
              height={32}
            />
          </g>
        ))}
      </g>
    );
  }
  return (
    <g>
      <rect
        x={CX - 104}
        y={CY - 52}
        width={208}
        height={104}
        rx={6}
        className="fill-success-tint stroke-line-strong"
        strokeWidth={1}
      />
      {[-78, -52, -26, 0, 26, 52, 78].map((offset) => (
        <line
          key={offset}
          x1={CX + offset}
          x2={CX + offset}
          y1={CY - 52}
          y2={CY + 52}
          className="stroke-line-strong"
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

// The seating bowl as numbered sections around the field. A section with tickets on sale is tinted and
// carries its lowest price; pressing it picks the section.
export function StadiumMap({
  map,
  sections,
  selected,
  onSelect,
  split,
  label,
}: {
  map: VenueMap;
  sections: Record<string, SectionInfo>;
  selected: string | null;
  onSelect: (section: string | null) => void;
  /** Draws the line between the two halves, when the bowl is shared by two sides. */
  split?: boolean;
  label: string;
}) {
  const wedges = map.rings.flatMap((ring, ringIndex) =>
    Array.from({ length: ring.count }, (_, index) => {
      const id = String(ring.first + index);
      return {
        id,
        info: sections[id],
        ...wedge(ringIndex, map.rings.length, index, ring.count),
      };
    }),
  );
  const onSale = wedges.filter((item) => item.info);

  return (
    <svg
      role="group"
      aria-label={label}
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
    >
      {split && (
        <line
          x1={CX}
          x2={CX}
          y1={8}
          y2={H - 8}
          strokeWidth={1.5}
          strokeDasharray="6 6"
          className="stroke-line-strong"
        />
      )}
      <Field kind={map.field} />
      {wedges.map((item) =>
        item.info ? null : (
          <path key={item.id} d={item.path} className="fill-surface-2" />
        ),
      )}
      {onSale.map((item) => {
        const chosen = item.id === selected;
        const price =
          item.info.from === null
            ? ""
            : `, from ${formatAmount(item.info.from)}`;
        const pick = () => onSelect(chosen ? null : item.id);
        return (
          <g
            key={item.id}
            role="button"
            tabIndex={0}
            aria-pressed={chosen}
            aria-label={`Section ${item.id}${price}`}
            onClick={pick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                pick();
              }
            }}
            className="group/section origin-center cursor-pointer rounded-sm transition-transform duration-(--dur-instant) ease-out transform-fill active:scale-(--scale-press)"
          >
            <path
              d={item.path}
              strokeWidth={1.5}
              className={cn(
                "stroke-accent-line transition-colors duration-(--dur-fast)",
                chosen
                  ? "fill-accent-active"
                  : "fill-accent group-hover/section:fill-accent-hover",
              )}
            />
            <g aria-hidden="true">
              <rect
                x={item.tag.x - 44}
                y={item.tag.y - 13}
                width={88}
                height={26}
                rx={13}
                className="fill-raised stroke-line-strong"
                strokeWidth={1}
              />
              <text
                x={item.tag.x}
                y={item.tag.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-fg text-xs font-medium"
              >
                {item.info.from === null
                  ? item.id
                  : `from ${formatAmount(item.info.from, { compact: true })}`}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
