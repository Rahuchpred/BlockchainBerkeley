import { formatAmount } from "@/components/lime/ui/amount";
import type { Activity } from "./store";

// Turns a recorded ledger step into words a fan can read.

const timeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

/** An account, shortened to its first and last characters. */
export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

export function describe(
  step: Activity,
  cut: number,
): { title: string; detail: string } {
  const amount = step.amount === undefined ? "" : formatAmount(step.amount);
  switch (step.kind) {
    case "minted":
      return {
        title: "Ticket created",
        detail: "The organizer minted it as a one-of-a-kind item.",
      };
    case "bought":
      return {
        title: `Bought for ${amount}`,
        detail:
          "The payment was locked in escrow and the ticket moved to the fan, in one step.",
      };
    case "listed":
      return {
        title: `Listed for ${amount}`,
        detail: "The holder put it up for resale at their own price.",
      };
    case "unlisted":
      return {
        title: "Taken off sale",
        detail: "The holder withdrew the offer.",
      };
    case "resold":
      return {
        title: `Resold for ${amount}`,
        detail: `Ticket and money swapped between two fans. The organizer received ${formatAmount((step.amount ?? 0) * cut)}.`,
      };
    case "sent":
      return {
        title: "Sent as a gift",
        detail: "The holder made a claim link for a friend.",
      };
    case "claimed":
      return {
        title: "Claimed",
        detail: "The friend took the ticket into their own wallet.",
      };
    case "released":
      return {
        title: `${amount} released to the organizer`,
        detail: "The finalists were decided, so the escrow was opened.",
      };
    case "refunded":
      return {
        title: `${amount} taken back by the fan`,
        detail:
          "The escrow was never released and its deadline passed, so the fan undid it.",
      };
    case "burned":
      return {
        title: "Expired and burned",
        detail: "Its team missed the final, so the ticket was removed.",
      };
  }
}
