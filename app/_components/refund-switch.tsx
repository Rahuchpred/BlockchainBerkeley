"use client";

import { useTransition } from "react";
import { Button } from "@/components/lime/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/lime/ui/card";
import { Status } from "@/components/lime/ui/status";
import { stageQuickRefunds } from "../actions";

// Demo only: the real refund deadline is a month after the event, so this brings it forward for
// tickets bought from now on. Tickets already bought keep the deadline they were sold with.
export function RefundSwitch({
  on,
  minutes,
  days,
}: {
  on: boolean;
  /** How soon a new purchase can be refunded while the switch is on. */
  minutes: number;
  /** How long after the event the real deadline is. */
  days: number;
}) {
  const [pending, start] = useTransition();

  return (
    <Card variant="surface" className="w-full">
      <div className="flex flex-col gap-1">
        <CardTitle>Refund deadline for new purchases</CardTitle>
        <CardDescription>
          {`Demo only. A fan can take back a payment that was never released ${days} days after the event. Shorten that to ${minutes} minutes to show a refund today. Tickets already bought keep their deadline.`}
        </CardDescription>
      </div>
      <Status
        status={on ? "queued" : "done"}
        label={
          on
            ? `New purchases can be refunded after ${minutes} minutes`
            : `New purchases can be refunded ${days} days after the event`
        }
      />
      <div>
        <Button
          variant={on ? "outline" : "secondary"}
          pending={pending}
          onClick={() => start(() => stageQuickRefunds(!on))}
        >
          {on ? "Use the real deadline" : `Shorten to ${minutes} minutes`}
        </Button>
      </div>
    </Card>
  );
}
