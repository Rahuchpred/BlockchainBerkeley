"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/lime/ui/button";
import { claimTicket } from "../actions";

// Takes a ticket a friend sent. The button stays busy until the ledger has moved it.
export function ClaimButton({
  offerId,
  hasWallet,
}: {
  offerId: string;
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
            const result = await claimTicket(offerId);
            if (result?.error) setError(result.error);
          })
        }
      >
        Claim this ticket
      </Button>
      {pending && (
        <p className="text-sm leading-normal text-fg-2">
          {hasWallet
            ? "Moving the ticket on the XRP Ledger. This takes a few seconds."
            : "Setting up your test wallet, then moving the ticket. This takes about a minute."}
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
