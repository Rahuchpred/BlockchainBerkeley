"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/lime/ui/button";
import { takeRefund } from "../actions";

/** The ledger's clock runs a few seconds behind, so the button waits that much longer to appear. */
const LEDGER_LAG_MS = 8_000;
/** A deadline further off than this is not worth a timer: the page will be loaded again by then. */
const WATCH_MS = 3_600_000;

// Takes back a payment that was never released, in exchange for the ticket. It shows only once the
// payment's deadline has passed, and appears by itself when that happens while the page is open.
export function RefundButton({
  nftId,
  after,
  ready,
  size,
  leave,
}: {
  nftId: string;
  /** When the payment can be taken back, as an ISO time. */
  after: string;
  /** The deadline had already passed when the page was made. */
  ready: boolean;
  size?: "sm";
  /** Go to the list of tickets afterwards. Set on a ticket's own page, which the refund removes. */
  leave?: boolean;
}) {
  const [reached, setReached] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready) return;
    const wait = new Date(after).getTime() + LEDGER_LAG_MS - Date.now();
    if (wait > WATCH_MS) return;
    const timer = setTimeout(() => setReached(true), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [after, ready]);

  if (!ready && !reached) return null;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          variant="secondary"
          size={size}
          pending={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await takeRefund(nftId, leave);
              if (result?.error) setError(result.error);
            })
          }
        >
          Take my money back
        </Button>
      </div>
      {pending && (
        <p className="text-sm leading-normal text-fg-2">
          Writing to the XRP Ledger. This takes a few seconds.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm leading-normal text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
