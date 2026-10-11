import { Button } from "@/components/lime/ui/button";
import type { Activity } from "@/lib/fairseat/store";
import { describe, formatTime } from "@/lib/fairseat/story";
import { RESALE_RATE, txUrl } from "@/lib/fairseat/xrpl";

// A ticket's life on the ledger, oldest step first, each with a link to its transaction.
export function LedgerTrail({ steps }: { steps: Activity[] }) {
  if (steps.length === 0) {
    return (
      <p className="text-sm leading-normal text-fg-2">
        This ticket was sold before Fairseat kept a trail. It is still on the
        ledger.
      </p>
    );
  }
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const { title, detail } = describe(step, RESALE_RATE);
        const last = index === steps.length - 1;
        return (
          <li key={`${step.at}-${step.kind}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={
                  last
                    ? "mt-1 size-3 shrink-0 rounded-full bg-ink"
                    : "mt-1 size-3 shrink-0 rounded-full border border-line-strong bg-surface-2"
                }
              />
              {!last && (
                <span aria-hidden="true" className="w-px flex-1 bg-line" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1 pb-6">
              <p className="text-base leading-snug font-medium">{title}</p>
              <p className="text-sm leading-normal text-fg-2">{detail}</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-fg-3">{formatTime(step.at)}</span>
                {step.hash && (
                  <Button
                    variant="link"
                    size="sm"
                    nativeButton={false}
                    render={
                      <a
                        href={txUrl(step.hash)}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    View on the ledger
                  </Button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
