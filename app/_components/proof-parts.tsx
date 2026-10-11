import Link from "next/link";
import { formatAmount } from "@/components/lime/ui/amount";
import { Button } from "@/components/lime/ui/button";
import { shortAddress } from "@/lib/fairseat/story";
import {
  accountRole,
  accountUrl,
  type LedgerAmount,
} from "@/lib/fairseat/xrpl";

// The pieces the proof pages share: how an amount, an account and a row of raw facts are shown.

/** Test dollars read as money. XRP, which only pays the ledger's fee, keeps its own name. */
export const money = (amount: LedgerAmount) =>
  amount.currency === "USD"
    ? formatAmount(amount.value)
    : `${amount.value} ${amount.currency}`;

const ROLES = {
  organizer: "the organizer",
  issuer: "the test dollar issuer",
  fan: "a fan",
};

/** Who an account is, in words. */
export const who = (address: string) => ROLES[accountRole(address)];

/** A shortened account that opens its own proof page. */
export function AccountLink({ address }: { address: string }) {
  return (
    <span className="flex flex-wrap items-baseline justify-end gap-x-2">
      <Button
        variant="link"
        size="sm"
        className="font-mono"
        nativeButton={false}
        render={<Link href={accountUrl(address)} />}
      >
        {shortAddress(address)}
      </Button>
      <span className="text-fg-3">{who(address)}</span>
    </span>
  );
}

export type Fact = { label: string; value: React.ReactNode };

/** Raw facts as rows: what it is on the left, the value from the ledger on the right. */
export function Facts({ facts }: { facts: Fact[] }) {
  return (
    <dl className="flex flex-col gap-2 text-sm">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
        >
          <dt className="text-fg-2">{fact.label}</dt>
          <dd className="min-w-0 text-end break-all">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The way out to the public explorer, for anyone who wants a second opinion. */
export function ExplorerLink({ href }: { href: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="self-start"
      nativeButton={false}
      render={<a href={href} target="_blank" rel="noreferrer" />}
    >
      Open in the public explorer
    </Button>
  );
}
