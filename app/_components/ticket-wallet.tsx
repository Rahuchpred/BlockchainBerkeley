"use client";

import { useState } from "react";
import { TeamMark } from "./team-mark";
import { Badge } from "@/components/lime/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/lime/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "@/components/lime/ui/empty";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";
import { formatAmount } from "@/components/lime/ui/amount";
import type { Condition } from "@/lib/fairseat/data";
import type { TicketStatus } from "@/lib/fairseat/live";
import type { QrShape } from "@/lib/fairseat/qr";
import { QrCode } from "./qr-code";

export type WalletTicket = {
  id: string;
  status: TicketStatus;
  team: string;
  /** What the team must do for the ticket to become the seat. */
  condition: Condition;
  image: string | null;
  event: string;
  date: string;
  place: string;
  seat: string;
  worth: number;
  /** Only a live ticket has a gate code. */
  qr?: QrShape;
};

const FILTERS: { value: "all" | TicketStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "live", label: "Live" },
  { value: "expired", label: "Expired" },
];

const STATUS: Record<
  TicketStatus,
  { label: string; variant: "accent" | "success" | "neutral" }
> = {
  open: { label: "Open", variant: "accent" },
  live: { label: "Live", variant: "success" },
  expired: { label: "Expired", variant: "neutral" },
};

function worthLine(ticket: WalletTicket) {
  if (ticket.status === "live") return "Your seat. Show the code at the gate.";
  if (ticket.status === "expired")
    return `${ticket.team} did not ${ticket.condition.make}.`;
  return `Worth ${formatAmount(ticket.worth)} now`;
}

export function TicketWallet({ tickets }: { tickets: WalletTicket[] }) {
  const [filter, setFilter] = useState("all");
  const shown =
    filter === "all"
      ? tickets
      : tickets.filter((ticket) => ticket.status === filter);

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        value={filter}
        onValueChange={setFilter}
        aria-label="Ticket status"
      >
        {FILTERS.map((item) => (
          <SegmentedItem key={item.value} value={item.value}>
            {item.label}
          </SegmentedItem>
        ))}
      </Segmented>
      {shown.length === 0 ? (
        <Empty>
          <EmptyTitle>No tickets here</EmptyTitle>
          <EmptyDescription>
            Tickets with this status will show up in this list.
          </EmptyDescription>
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((ticket) => (
            <li key={ticket.id} className="flex">
              <Card
                interactive
                href={`/tickets/${ticket.id}`}
                variant="surface"
                className="w-full"
              >
                <div className="flex items-start justify-between gap-3">
                  <TeamMark image={ticket.image} team={ticket.team} size="lg" />
                  <Badge variant={STATUS[ticket.status].variant}>
                    {STATUS[ticket.status].label}
                  </Badge>
                </div>
                <CardTitle>{`If ${ticket.team} ${ticket.condition.make}`}</CardTitle>
                <div className="flex flex-col gap-1">
                  <CardDescription>{ticket.event}</CardDescription>
                  <CardDescription>{ticket.date}</CardDescription>
                  <CardDescription>{ticket.place}</CardDescription>
                  <CardDescription className="tabular-nums">
                    {ticket.seat}
                  </CardDescription>
                </div>
                {ticket.qr && (
                  <QrCode
                    shape={ticket.qr}
                    label={`Gate code for ${ticket.seat}`}
                    className="size-32 rounded-md"
                  />
                )}
                <p className="text-sm text-fg-2">{worthLine(ticket)}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
