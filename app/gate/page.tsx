import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/lime/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/lime/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { Status, type StatusName } from "@/components/lime/ui/status";
import { conditionOf, formatDate, seatLabel } from "@/lib/fairseat/data";
import { findEvent } from "@/lib/fairseat/events";
import { viewTicket, type TicketView } from "@/lib/fairseat/live";
import { activityFor, holderOf, type Activity } from "@/lib/fairseat/store";
import { shortAddress } from "@/lib/fairseat/story";
import { accountUrl, findTicket } from "@/lib/fairseat/xrpl";
import { LedgerTrail } from "../_components/ledger-trail";
import { PageSkeleton } from "../_components/page-skeleton";
import { TeamMark } from "../_components/team-mark";

type Verdict = {
  status: StatusName;
  label: "Let them in" | "Not yet" | "Refuse";
  why: string;
  /** The ticket's id, when the code was one. */
  nftId?: string;
  view?: TicketView;
  holder?: string;
};

const refuse = (why: string, nftId?: string): Verdict => ({
  status: "failed",
  label: "Refuse",
  why,
  nftId,
});

/** How to say a burned ticket's team is out, from the side its seat was on. */
function missedWords(step: Activity) {
  const event = findEvent(step.eventId);
  const seat = event?.seats.find((item) => item.id === step.seatId);
  return conditionOf(event?.sides.find((side) => side.id === seat?.side))
    .missed;
}

/** Asks the ledger whether the holder of this ticket code gets in. */
async function judge(code: string): Promise<Verdict> {
  // A scanned pass reads fairseat:<id>. A typed code is the id alone.
  const nftId = code
    .trim()
    .replace(/^fairseat:/i, "")
    .toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(nftId))
    return refuse("This is not a Fairseat ticket code.");

  // The local index only says where to look first. The ledger gives the answer.
  const found = await findTicket(nftId, holderOf(nftId));
  if (!found.found) {
    if (found.reason === "not-ours")
      return refuse("This was not minted by the Fairseat organizer.", nftId);
    const burned = activityFor(nftId).find((step) => step.kind === "burned");
    return refuse(
      !burned
        ? "No ticket with this code was found on the ledger."
        : burned.returned
          ? "This ticket was burned when its payment was taken back."
          : `This ticket was burned when its team ${missedWords(burned)}.`,
      nftId,
    );
  }

  const { holder, ...record } = found.ticket;
  const view = await viewTicket(
    {
      id: nftId,
      eventId: record.eventId,
      seatId: record.seatId,
      team: record.team,
      paid: record.paid,
    },
    findEvent(record.eventId),
  );
  if (!view)
    return refuse("This ticket is for an event that is not on sale.", nftId);

  const { team } = view.outcome;
  const condition = conditionOf(view.side);
  const rest = { nftId, view, holder };
  if (view.status === "live")
    return {
      ...rest,
      status: "done",
      label: "Let them in",
      why: `${team} ${condition.made}, so this ticket is the seat.`,
    };
  if (view.status === "open")
    return {
      ...rest,
      status: "queued",
      label: "Not yet",
      why: view.side.condition
        ? `This is not decided yet. This ticket becomes the seat only if ${team} ${condition.make}.`
        : `The final is not decided. This ticket becomes the seat only if ${team} make it.`,
    };
  return { ...refuse(`${team} ${condition.missed}.`), ...rest };
}

function Result({ verdict }: { verdict: Verdict }) {
  const { view, holder, nftId } = verdict;
  // The steps Fairseat recorded for this ticket, each with its proof. Empty for a code it never saw.
  const steps = nftId ? activityFor(nftId) : [];
  return (
    <Card variant="outline">
      <div className="flex flex-col gap-1">
        <Status status={verdict.status} label={verdict.label} />
        <CardTitle>{verdict.why}</CardTitle>
      </div>
      {view && (
        <div className="flex items-center gap-3">
          <TeamMark
            image={view.outcome.image}
            team={view.outcome.team}
            size="lg"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-base font-medium">{view.outcome.team}</p>
            <CardDescription>
              {view.event.title}, {formatDate(view.event.date)}
            </CardDescription>
            <CardDescription className="tabular-nums">
              {seatLabel(view.seat)}
            </CardDescription>
          </div>
        </div>
      )}
      {holder && (
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-fg-2">Held by</span>
          <span className="font-mono">{shortAddress(holder)}</span>
        </div>
      )}
      {holder && (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={accountUrl(holder)} />}
        >
          View the holder on the ledger
        </Button>
      )}
      {steps.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-medium">This ticket on the ledger</h2>
          <LedgerTrail steps={steps} />
        </section>
      )}
    </Card>
  );
}

async function GatePageContent({
  searchParams,
}: Pick<PageProps<"/gate">, "searchParams">) {
  const { code: given } = await searchParams;
  await connection();
  const code = (Array.isArray(given) ? given[0] : given)?.trim() ?? "";
  // A ledger that cannot be reached is not a reason to turn a fan away.
  const verdict = code ? await judge(code).catch(() => null) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <div className="flex flex-col gap-2">
        <h1 className="title-page">Gate check</h1>
        <p className="text-base leading-normal text-fg-2">
          Enter the code on a fan&apos;s ticket. The XRP Ledger says whether to
          let them in.
        </p>
      </div>
      <Form action="/gate" className="flex flex-col gap-4">
        <Field name="code">
          <FieldLabel>Ticket code</FieldLabel>
          <Input
            className="font-mono"
            defaultValue={code}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
          />
          <FieldDescription>
            The 64 characters of the ticket&apos;s id, or what its gate pass
            scans to.
          </FieldDescription>
        </Field>
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          Check the ticket
        </Button>
      </Form>
      {verdict && <Result verdict={verdict} />}
      {verdict === null && (
        <p role="alert" className="text-sm leading-normal text-danger-text">
          The ledger could not be reached. Check the ticket again.
        </p>
      )}
    </main>
  );
}

export default function GatePage({ searchParams }: PageProps<"/gate">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <GatePageContent searchParams={searchParams} />
    </Suspense>
  );
}
