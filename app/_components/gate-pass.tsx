import { Badge } from "@/components/lime/ui/badge";
import type { QrShape } from "@/lib/fairseat/qr";
import { QrCode } from "./qr-code";
import { TeamMark } from "./team-mark";

// What a ticket turns into once its team makes the final: the pass a fan shows at the gate.
export function GatePass({
  team,
  image,
  event,
  when,
  place,
  section,
  row,
  seat,
  qr,
  code,
}: {
  team: string;
  image: string | null;
  event: string;
  when: string;
  place: string;
  section: string;
  row: string;
  seat: string;
  qr: QrShape;
  /** The ticket's id on the ledger, shortened, printed under the code. */
  code: string;
}) {
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-panel border border-line-strong bg-raised transition-[opacity,transform] duration-(--dur-slow) ease-out starting:scale-95 starting:opacity-0">
      <div className="flex items-center gap-3 bg-accent-wash p-4">
        <TeamMark image={image} team={team} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-base leading-snug font-semibold">
            {event}
          </p>
          <p className="truncate text-sm text-fg-2">{when}</p>
          <p className="truncate text-sm text-fg-2">{place}</p>
        </div>
        <Badge variant="success">Admit one</Badge>
      </div>
      <dl className="grid grid-cols-3 gap-3 p-4">
        {[
          ["Section", section],
          ["Row", row],
          ["Seat", seat],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-sm text-fg-2">{label}</dt>
            <dd className="font-mono text-2xl font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col items-center gap-3 border-t border-dashed border-line-strong p-4">
        <QrCode
          shape={qr}
          label={`Gate code for section ${section}, row ${row}, seat ${seat}`}
          className="size-48 rounded-md"
        />
        <p className="font-mono text-sm text-fg-3">{code}</p>
      </div>
    </div>
  );
}
