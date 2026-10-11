"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/lime/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { Status } from "@/components/lime/ui/status";
import { formatAmount } from "@/components/lime/ui/amount";
import { offerHeldTicket, withdrawOffer, type ActionResult } from "../actions";

// What a holder can do with an open ticket: list it for sale, send it to a friend, or take the offer back.
export function TicketActions({
  nftId,
  worth,
  cut,
  offer,
}: {
  nftId: string;
  /** What the ticket would cost new right now. The starting point for a price. */
  worth: number;
  /** The organizer's share of a resale, 0 to 1. */
  cut: number;
  /** The open offer on this ticket, if any. A price of 0 is a gift waiting to be claimed. */
  offer: { offerId: string; price: number } | null;
}) {
  const [price, setPrice] = useState(worth.toFixed(2));
  const [busy, setBusy] = useState<"sell" | "send" | "withdraw" | null>(null);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = (what: typeof busy, action: () => Promise<ActionResult>) => {
    setBusy(what);
    setError(null);
    start(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      setBusy(null);
    });
  };

  const asking = Number(price);
  const keeps = asking > 0 ? asking * (1 - cut) : 0;
  const problem = error && (
    <p role="alert" className="text-sm leading-normal text-danger-text">
      {error}
    </p>
  );
  const waiting = busy && (
    <p className="text-sm leading-normal text-fg-2">
      Writing to the XRP Ledger. This takes a few seconds.
    </p>
  );

  if (offer) {
    const gift = offer.price === 0;
    const link =
      typeof window === "undefined"
        ? `/claim/${offer.offerId}`
        : `${window.location.origin}/claim/${offer.offerId}`;
    return (
      <div className="flex flex-col gap-3">
        <Status
          status="queued"
          label={
            gift
              ? "Waiting for your friend to claim it"
              : `Listed for ${formatAmount(offer.price)}`
          }
        />
        <p className="max-w-xl text-sm leading-normal text-fg-2">
          {gift
            ? "Anyone who opens the link can claim this ticket, so only share it with the person it is for."
            : `Fans see it on the seat page. When one buys it you get ${formatAmount(offer.price * (1 - cut))}, after the organizer's ${Math.round(cut * 100)}%.`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {gift && (
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? "Link copied" : "Copy the claim link"}
            </Button>
          )}
          <Button
            variant="outline"
            pending={busy === "withdraw"}
            onClick={() => run("withdraw", () => withdrawOffer(nftId))}
          >
            {gift ? "Take it back" : "Take it off sale"}
          </Button>
        </div>
        {waiting}
        {problem}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <Field name="price">
          <FieldLabel>Your price in dollars</FieldLabel>
          <Input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <FieldDescription>
            {keeps > 0
              ? `You get ${formatAmount(keeps)}. The organizer keeps ${Math.round(cut * 100)}% of every resale.`
              : "Enter the price you want."}
          </FieldDescription>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          pending={busy === "sell"}
          disabled={!(asking > 0) || busy !== null}
          onClick={() => run("sell", () => offerHeldTicket(nftId, asking))}
        >
          List for sale
        </Button>
        <Button
          variant="outline"
          pending={busy === "send"}
          disabled={busy !== null}
          onClick={() => run("send", () => offerHeldTicket(nftId, 0))}
        >
          Send to a friend
        </Button>
      </div>
      {waiting}
      {problem}
    </div>
  );
}
