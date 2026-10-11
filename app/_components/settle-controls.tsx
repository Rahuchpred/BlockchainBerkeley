"use client";

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
import { stageSettlement } from "../actions";

export type SettleSide = {
  market: string;
  event: string;
  name: string;
  teams: string[];
  /** The team staged as the finalist, if any. */
  staged: string | null;
  /** The market has really settled on Gemini, so there is nothing to stage. */
  final: boolean;
};

// Demo only: stands in for the day a market settles, so the last step can be shown before it happens.
export function SettleControls({ sides }: { sides: SettleSide[] }) {
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [pending, start] = useTransition();

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
                  {!side.final && (
                    <div>
                      <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          start(() => stageSettlement(side.market, null))
                        }
                      >
                        Undo
                      </Button>
                    </div>
                  )}
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
