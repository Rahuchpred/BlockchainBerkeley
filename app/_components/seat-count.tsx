"use client";

import { usePathname, useRouter } from "next/navigation";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";

// How many seats to buy together. The choice is kept in the address, so the page and the server
// both read it from there.
export function SeatCount({ value, max }: { value: number; max: number }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Segmented
      aria-label="Seats together"
      value={String(value)}
      onValueChange={(count) =>
        router.replace(
          count === "1" ? pathname : `${pathname}?seats=${count}`,
          {
            scroll: false,
          },
        )
      }
    >
      {Array.from({ length: max }, (_, index) => (
        <SegmentedItem key={index} value={String(index + 1)}>
          {String(index + 1)}
        </SegmentedItem>
      ))}
    </Segmented>
  );
}
