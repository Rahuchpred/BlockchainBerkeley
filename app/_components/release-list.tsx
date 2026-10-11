"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/lime/ui/badge";
import { Button } from "@/components/lime/ui/button";
import { LiveValue } from "./live";
import { List, ListItem } from "@/components/lime/ui/list";
import { releaseSection } from "../actions";

export type ReleaseRow = {
  section: string;
  seats: number;
  /** How many of those seats this team has already released its ticket for. */
  released: number;
  /** What this team's ticket for one of these seats costs at the live odds. */
  price: number;
};

// The sections a team can release its tickets in. Releasing mints them on the ledger from the
// team's own organizer wallet, so the button stays busy until the ledger has confirmed it.
export function ReleaseList({
  eventId,
  team,
  ready,
  rows,
}: {
  eventId: string;
  team: string;
  /** The team's organizer wallet already exists on the ledger. */
  ready: boolean;
  rows: ReleaseRow[];
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <List variant="grouped">
        {rows.map((row) => {
          const left = row.seats - row.released;
          return (
            <ListItem
              key={row.section}
              title={`Section ${row.section}`}
              // Kept short: on a phone the row shares its width with the button.
              description={
                <>
                  {row.seats} seats, <LiveValue value={row.price} /> each
                </>
              }
              trailing={
                left === 0 ? (
                  <Badge variant="success">All released</Badge>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    pending={busy === row.section}
                    disabled={pending}
                    onClick={() => {
                      setBusy(row.section);
                      start(async () => {
                        setError(null);
                        const result = await releaseSection(
                          eventId,
                          row.section,
                        );
                        if (result?.error) setError(result.error);
                        setBusy(null);
                      });
                    }}
                  >
                    {`Release ${left} ${left === 1 ? "ticket" : "tickets"}`}
                  </Button>
                )
              }
            />
          );
        })}
      </List>
      {pending && (
        <p className="text-sm leading-normal text-fg-2">
          {ready
            ? "Minting the tickets on the XRP Ledger. This takes about 10 seconds."
            : `Opening the ${team} wallet on the XRP Ledger, then minting the tickets. This takes about 30 seconds.`}
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
