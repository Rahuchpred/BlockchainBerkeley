"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/lime/ui/button";
import { buyTeamTickets } from "../actions";

// Pays for a ticket on the ledger, or for a few seats together in one payment. The button stays
// busy until the ledger has confirmed the swap.
export function PayButton({
  eventId,
  seatIds,
  team,
  label,
  hasWallet,
}: {
  eventId: string;
  seatIds: string[];
  team: string;
  label: string;
  hasWallet: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <Button
        size="lg"
        className="w-full"
        pending={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await buyTeamTickets(eventId, seatIds, team);
            if (result?.error) setError(result.error);
          })
        }
      >
        {label}
      </Button>
      {pending && (
        <p className="text-sm leading-normal text-fg-2">
          {hasWallet
            ? `Paying on the XRP Ledger. This takes about ${seatIds.length > 1 ? "half a minute" : "15 seconds"}.`
            : "Setting up your test wallet with $5,000 in test dollars, then paying. This takes about a minute."}
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
