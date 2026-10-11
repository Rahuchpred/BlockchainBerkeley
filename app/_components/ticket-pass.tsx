import { Badge } from "@/components/lime/ui/badge";
import { formatAmount } from "@/components/lime/ui/amount";
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

// The ticket drawn as a ticket: the team's color on top, the seat in large numbers, the money under
// it. Once the team makes the final it carries the code a fan shows at the gate.
export function TicketPass({
  team,
  image,
  tone,
  event,
  when,
  place,
  section,
  row,
  seat,
  status,
  paid,
  worth,
  locked,
  qr,
  code,
}: {
  team: string;
  image: string | null;
  tone: number;
  event: string;
  when: string;
  place: string;
  section: string;
  row: string;
  seat: string;
  status: TicketStatus;
  paid: number;
  worth: number;
  /** What is still held in escrow for this ticket, if this fan paid for it. */
  locked: number | null;
  /** Only a live ticket has a gate code. */
  qr?: QrShape;
  /** The ticket's id on the ledger, shortened. */
  code: string;
}) {
  const gain = worth - paid;
  return (
    <div
      className="w-full overflow-hidden rounded-panel border border-line-strong bg-raised transition-[opacity,transform] duration-(--dur-slow) ease-out starting:scale-95 starting:opacity-0"
      style={
        { "--tone-soft": `var(--team-${tone}-soft)` } as React.CSSProperties
      }
    >
      <div className="flex items-center gap-3 bg-(--tone-soft) p-4">
        <TeamMark image={image} team={team} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-lg leading-snug font-semibold">
            {`If ${team} make the final`}
          </p>
          <p className="truncate text-sm text-fg-2">{`${event}, ${when}`}</p>
          <p className="truncate text-sm text-fg-2">{place}</p>
        </div>
        <Badge variant={STATUS[status].variant}>{STATUS[status].label}</Badge>
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

      {qr ? (
        <div className="flex flex-col items-center gap-3 border-t border-dashed border-line-strong p-4">
          <QrCode
            shape={qr}
            label={`Gate code for section ${section}, row ${row}, seat ${seat}`}
            className="size-44 rounded-md"
          />
          <p className="font-mono text-sm text-fg-3">{code}</p>
        </div>
      ) : (
        <dl className="grid grid-cols-3 gap-3 border-t border-dashed border-line-strong p-4">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-fg-2">You paid</dt>
            <dd className="font-mono text-base font-medium tabular-nums">
              {formatAmount(paid)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-fg-2">Worth now</dt>
            <dd className="font-mono text-base font-medium tabular-nums">
              {formatAmount(worth)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-fg-2">Gain or loss</dt>
            <dd
              className={
                gain > 0
                  ? "font-mono text-base font-medium text-success-text tabular-nums"
                  : gain < 0
                    ? "font-mono text-base font-medium text-danger-text tabular-nums"
                    : "font-mono text-base font-medium tabular-nums"
              }
            >
              {formatAmount(gain, { signed: true })}
            </dd>
          </div>
        </dl>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface px-4 py-3">
        <span className="font-mono text-xs text-fg-3">{code}</span>
        {locked !== null && (
          <Badge variant="outline">{`${formatAmount(locked)} held in escrow`}</Badge>
        )}
      </div>
    </div>
  );
}
