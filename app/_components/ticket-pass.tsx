"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/lime/ui/badge";
import { Button } from "@/components/lime/ui/button";
import { formatAmount } from "@/components/lime/ui/amount";
import { Icon, Renew } from "@/components/lime/icon";
import { cn } from "@/lib/lime/utils";
import type { Condition } from "@/lib/fairseat/data";
import type { TicketStatus } from "@/lib/fairseat/live";
import type { QrShape } from "@/lib/fairseat/qr";
import { QrCode } from "./qr-code";
import { TeamMark } from "./team-mark";

const STATUS: Record<
  TicketStatus,
  { label: string; variant: "accent" | "success" | "neutral" }
> = {
  open: { label: "Open", variant: "accent" },
  live: { label: "Admit one", variant: "success" },
  expired: { label: "Expired", variant: "neutral" },
};

const FACE =
  "relative col-start-1 row-start-1 flex min-w-0 flex-col rounded-panel border border-line-strong bg-raised backface-hidden";

// The line a ticket tears along, with a half circle bitten out of each edge.
function Perforation() {
  return (
    <div aria-hidden="true" className="relative h-6">
      <span className="absolute inset-y-0 -left-px w-3 rounded-r-full border border-l-0 border-line-strong bg-page" />
      <span className="absolute inset-x-5 top-1/2 border-t border-dashed border-line-strong" />
      <span className="absolute inset-y-0 -right-px w-3 rounded-l-full border border-r-0 border-line-strong bg-page" />
    </div>
  );
}

// The ticket's ledger id drawn as bars: each character sets the width of one bar and the gap after
// it, so no two tickets carry the same strip. It is a mark, not a code a scanner reads.
function Bars({ id }: { id: string }) {
  let x = 0;
  const bars = [...id].map((char) => {
    const value = Number.parseInt(char, 16) || 0;
    const bar = { x, width: 1 + (value & 3) };
    x += bar.width + 1 + (value >> 2);
    return bar;
  });
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${x} 10`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className="h-8 w-full text-fg"
    >
      {bars.map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          width={bar.width}
          height={10}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

function Money({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-2">{label}</dt>
      <dd className={cn("font-mono tabular-nums", className)}>{value}</dd>
    </div>
  );
}

// The ticket drawn as a ticket: the team's color on top, the seat in large numbers, then a stub that
// tears off along a perforated line. Once the team is through the stub carries the code a fan
// shows at the gate. The back holds the money and the ticket's place on the ledger.
export function TicketPass({
  id,
  href,
  team,
  condition,
  image,
  tone,
  event,
  when,
  place,
  section,
  row,
  seat,
  status,
  faceValue,
  paid,
  worth,
  locked,
  cut,
  qr,
}: {
  /** The ticket's id on the ledger. */
  id: string;
  /** Where anyone can look the ticket up. */
  href: string;
  team: string;
  /** What the team must do for the ticket to become the seat. */
  condition: Condition;
  image: string | null;
  tone: number;
  event: string;
  when: string;
  place: string;
  section: string;
  row: string;
  seat: string;
  status: TicketStatus;
  /** The full price of the seat. */
  faceValue: number;
  paid: number;
  worth: number;
  /** What is still held in escrow for this ticket, if this fan paid for it. */
  locked: number | null;
  /** The organizer's share of a resale, as a fraction. */
  cut: number;
  /** Only a live ticket has a gate code. */
  qr?: QrShape;
}) {
  const [flipped, setFlipped] = useState(false);
  const gain = worth - paid;
  const gainTone =
    gain > 0 ? "text-success-text" : gain < 0 ? "text-danger-text" : undefined;
  const code = `${id.slice(0, 8)}...${id.slice(-8)}`;
  const seatName = `section ${section}, row ${row}, seat ${seat}`;

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-3">
      <div
        className="w-full transition-[opacity,transform] duration-(--dur-slow) ease-out starting:scale-95 starting:opacity-0"
        style={
          { "--tone-soft": `var(--team-${tone}-soft)` } as React.CSSProperties
        }
      >
        <div
          className={cn(
            "grid grid-cols-1 transition-transform duration-(--dur-slow) ease-out transform-3d motion-reduce:transition-none",
            flipped && "rotate-y-180",
          )}
        >
          <div className={FACE} inert={flipped}>
            <div className="flex items-center gap-3 rounded-t-panel bg-(--tone-soft) p-4">
              <TeamMark image={image} team={team} size="lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-lg leading-snug font-semibold">
                  {`If ${team} ${condition.make}`}
                </p>
                <p className="truncate text-sm text-fg-2">{`${event}, ${when}`}</p>
                <p className="truncate text-sm text-fg-2">{place}</p>
              </div>
              <Badge variant={STATUS[status].variant}>
                {STATUS[status].label}
              </Badge>
            </div>

            <dl className="grid grid-cols-3 gap-3 p-4">
              {[
                ["Section", section],
                ["Row", row],
                ["Seat", seat],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <dt className="text-sm text-fg-2">{label}</dt>
                  <dd className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <Perforation />

            {qr ? (
              <div className="flex flex-1 items-center gap-4 p-4">
                <QrCode
                  shape={qr}
                  label={`Gate code for ${seatName}`}
                  className="size-32 shrink-0 rounded-md"
                />
                <p className="text-sm leading-normal text-fg-2">
                  {`${team} ${condition.made}, so this ticket is the seat. Show this code at the gate.`}
                </p>
              </div>
            ) : (
              <dl className="grid flex-1 grid-cols-3 gap-3 p-4">
                {[
                  ["You paid", formatAmount(paid), undefined],
                  ["Worth now", formatAmount(worth), undefined],
                  [
                    "Gain or loss",
                    formatAmount(gain, { signed: true }),
                    gainTone,
                  ],
                ].map(([label, value, valueTone]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <dt className="text-sm text-fg-2">{label}</dt>
                    <dd
                      className={cn(
                        "font-mono text-base font-medium tabular-nums",
                        valueTone,
                      )}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="flex flex-col gap-2 rounded-b-panel bg-surface px-4 py-3">
              <Bars id={id} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-fg-3">{code}</span>
                {locked !== null && (
                  <Badge variant="outline">{`${formatAmount(locked)} held in escrow`}</Badge>
                )}
              </div>
            </div>
          </div>

          <div className={cn(FACE, "rotate-y-180")} inert={!flipped}>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <p className="text-lg leading-snug font-semibold">
                How this ticket works
              </p>
              <p className="text-sm leading-normal text-fg-2">
                {status === "open"
                  ? `It becomes ${seatName} if ${team} ${condition.make}, and expires if they do not.`
                  : status === "live"
                    ? `${team} ${condition.made}, so this ticket is ${seatName}.`
                    : `${team} did not ${condition.make}, so this ticket has expired.`}
              </p>
              <dl className="flex flex-col gap-2 text-sm">
                <Money
                  label="Full seat price"
                  value={formatAmount(faceValue)}
                />
                <Money label="You paid" value={formatAmount(paid)} />
                <Money label="Worth now" value={formatAmount(worth)} />
                <Money
                  label="Gain or loss"
                  value={formatAmount(gain, { signed: true })}
                  className={gainTone}
                />
                {locked !== null && (
                  <Money label="Held in escrow" value={formatAmount(locked)} />
                )}
                <Money
                  label="Organizer's share of a resale"
                  value={`${Math.round(cut * 100)}%`}
                />
              </dl>
            </div>

            <Perforation />

            <div className="flex flex-col gap-3 rounded-b-panel p-4">
              <p className="font-mono text-xs break-all text-fg-2">{id}</p>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={href} />}
                >
                  View on the ledger
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        aria-pressed={flipped}
        onClick={() => setFlipped((now) => !now)}
        icon={<Icon icon={Renew} size={16} />}
      >
        {flipped ? "Show the front" : "Show the back"}
      </Button>
    </div>
  );
}
