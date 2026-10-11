"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/lime/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/lime/ui/card";
import { Field, FieldLabel } from "@/components/lime/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/lime/ui/select";
import { Status } from "@/components/lime/ui/status";
import { formatAmount } from "@/components/lime/ui/amount";
import {
  settleOnLedger,
  stageSettlement,
  type LedgerSettlement,
} from "../actions";

export type SettleSide = {
  market: string;
  event: string;
  name: string;
  teams: string[];
  /** The team staged as the finalist, if any. */
  staged: string | null;
  /** The market has really settled on Gemini, so there is nothing to stage. */
  final: boolean;
  /** Links to the transactions that settled this side on the ledger, once that is done. */
  ledger: string[] | null;
};

// Demo only: stands in for the day a market settles, so the last step can be shown before it happens.
export function SettleControls({ sides }: { sides: SettleSide[] }) {
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, LedgerSettlement>>({});

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {sides.map((side) => {
        const choice = picked[side.market] ?? null;
        const items = side.teams.map((team) => ({ value: team, label: team }));
        return (
          <li key={side.market} className="flex">
            <Card variant="surface" className="w-full">
              <div className="flex flex-col gap-1">
                <CardTitle>{side.name}</CardTitle>
                <CardDescription>{side.event}</CardDescription>
              </div>
              {side.staged ? (
                <>
                  <Status
                    status="done"
                    label={`${side.staged} made the final`}
                  />
                  {side.ledger ? (
                    <>
                      <Status status="done" label="Settled on the XRP Ledger" />
                      <div className="flex flex-wrap gap-3">
                        {side.ledger.map((link, index) => (
                          <Button
                            key={link}
                            variant="outline"
                            size="sm"
                            nativeButton={false}
                            render={
                              <Link href={link} />
                            }
                          >
                            {side.ledger?.length === 1
                              ? "View the transaction"
                              : `View transaction ${index + 1}`}
                          </Button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm leading-normal text-fg-2">
                        Settling on the ledger releases every payment held for
                        this side to the organizer and burns the tickets that
                        expired. It cannot be undone.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="secondary"
                          pending={busy === side.market}
                          disabled={pending || busy !== null}
                          onClick={() => {
                            setBusy(side.market);
                            start(async () => {
                              const result = await settleOnLedger(side.market);
                              setResults((known) => ({
                                ...known,
                                [side.market]: result,
                              }));
                              setBusy(null);
                            });
                          }}
                        >
                          Settle on the ledger
                        </Button>
                        {!side.final && (
                          <Button
                            variant="outline"
                            disabled={pending || busy !== null}
                            onClick={() =>
                              start(() => stageSettlement(side.market, null))
                            }
                          >
                            Undo
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                  {(() => {
                    const result = results[side.market];
                    if (!result) return null;
                    return "error" in result ? (
                      <p
                        role="alert"
                        className="text-sm leading-normal text-danger-text"
                      >
                        {result.error}
                      </p>
                    ) : (
                      <p className="text-sm leading-normal text-fg-2">
                        {`Released ${formatAmount(result.dollars)} from ${result.released} ${result.released === 1 ? "payment" : "payments"} and burned ${result.burned} expired ${result.burned === 1 ? "ticket" : "tickets"}.`}
                      </p>
                    );
                  })()}
                </>
              ) : (
                <>
                  <Field name={side.market}>
                    <FieldLabel>Team that makes the final</FieldLabel>
                    <Select
                      items={items}
                      value={choice}
                      onValueChange={(value) =>
                        setPicked({ ...picked, [side.market]: value })
                      }
                    >
                      <SelectTrigger
                        placeholder="Choose a team"
                        className="w-full"
                      />
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div>
                    <Button
                      variant="secondary"
                      disabled={!choice || pending}
                      onClick={() =>
                        start(() => stageSettlement(side.market, choice))
                      }
                    >
                      Settle this side
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
