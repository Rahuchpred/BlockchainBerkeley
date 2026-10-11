import { Card } from "@/components/lime/ui/card";
import { LiveValue } from "./live";

// One headline number with what it counts, for the top of a dashboard. A number rolls and is
// tinted when it changes. Words, such as Unavailable, are shown as they are.
export function Stat({
  label,
  value,
  kind = "amount",
  note,
}: {
  label: string;
  value: number | string;
  /** How a number is written: dollars unless it is a plain count. */
  kind?: "amount" | "count";
  note?: string;
}) {
  return (
    <Card variant="surface" className="w-full">
      <p className="text-sm text-fg-2">{label}</p>
      <p className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
        {typeof value === "number" ? (
          <LiveValue value={value} kind={kind} label={label} arrow />
        ) : (
          value
        )}
      </p>
      {note && <p className="text-sm text-fg-3">{note}</p>}
    </Card>
  );
}
