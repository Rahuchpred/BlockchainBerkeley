"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Balance } from "@/components/lime/ui/balance";
import { Button } from "@/components/lime/ui/button";
import { getTestWallet } from "../actions";

// The fan's test dollars, or the button that makes them a wallet.
export function WalletChip({ balance }: { balance: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  if (balance !== null) {
    return (
      <Balance
        value={balance}
        actionLabel="Open my tickets"
        onClick={() => router.push("/tickets")}
      />
    );
  }

  return (
    <Button
      variant="solid"
      size="sm"
      pending={pending}
      onClick={() =>
        start(async () => {
          const result = await getTestWallet();
          setFailed(Boolean(result?.error));
          if (!result?.error) router.refresh();
        })
      }
    >
      {failed ? "Try the wallet again" : "Get a test wallet"}
    </Button>
  );
}
