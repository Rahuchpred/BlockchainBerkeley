import { Card } from "@/components/lime/ui/card";

// One headline number with what it counts, for the top of a dashboard.
export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <Card variant="surface" className="w-full">
      <p className="text-sm text-fg-2">{label}</p>
      <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {note && <p className="text-sm text-fg-3">{note}</p>}
    </Card>
  );
}
