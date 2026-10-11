"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ValueFlash } from "@/components/interior/value-flash";
import { formatAmount } from "@/components/lime/ui/amount";
import { percent } from "@/lib/fairseat/data";

const FORMATS = {
  amount: (value: number) => formatAmount(value),
  percent,
  count: (value: number) => String(value),
};

/**
 * A number that is live: when it changes, the new figure rolls in and is tinted for a moment in the
 * direction it moved. It sets no type of its own, so it reads like the text around it.
 */
export function LiveValue({
  value,
  kind = "amount",
  label,
  arrow,
  className,
}: {
  value: number;
  /** How the number is written: dollars, a share of the seat, or a plain count. */
  kind?: keyof typeof FORMATS;
  /** What the number is, for a screen reader, when the text around it does not say. */
  label?: string;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <ValueFlash
      value={value}
      format={FORMATS[kind]}
      label={label}
      arrow={arrow}
      className={className}
    />
  );
}

const REFRESH_MS = 15_000;

/**
 * Keeps a page's odds, prices and balances fresh: it asks the server for the page again every few
 * seconds while the tab is in view. Nothing reloads. Only the numbers that moved change.
 */
export function LiveRefresh({ every = REFRESH_MS }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, every);
    // A tab that was away catches up the moment it is looked at again.
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, every]);
  return null;
}
