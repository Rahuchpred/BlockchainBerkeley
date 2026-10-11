import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/lime/ui/button";
import { Card, CardTitle } from "@/components/lime/ui/card";
import {
  Empty,
  EmptyActions,
  EmptyDescription,
  EmptyTitle,
} from "@/components/lime/ui/empty";
import { Status } from "@/components/lime/ui/status";
import { formatFarTime, formatTime } from "@/lib/fairseat/story";
import {
  explorerTxUrl,
  readTransaction,
  ticketUrl,
  type ProofStep,
  type ProofTransaction,
} from "@/lib/fairseat/xrpl";
import { PageSkeleton } from "../../_components/page-skeleton";
import {
  AccountLink,
  ExplorerLink,
  Facts,
  money,
  who,
  type Fact,
} from "../../_components/proof-parts";

const shortId = (id: string) => `${id.slice(0, 8)}...${id.slice(-6)}`;

const account = (label: string, address: string | null): Fact[] =>
  address ? [{ label, value: <AccountLink address={address} /> }] : [];

const mono = (label: string, id: string | null): Fact[] =>
  id
    ? [{ label, value: <span className="font-mono">{shortId(id)}</span> }]
    : [];

/** A ticket's id, opening the gate check that asks the ledger about it. */
const ticket = (id: string | null): Fact[] =>
  id
    ? [
        {
          label: "Ticket",
          value: (
            <Button
              variant="link"
              size="sm"
              className="font-mono"
              nativeButton={false}
              render={<Link href={ticketUrl(id)} />}
            >
              {shortId(id)}
            </Button>
          ),
        },
      ]
    : [];

/** One step in words, with the accounts and ids the ledger recorded for it. */
function explain(step: ProofStep): { title: string; facts: Fact[] } {
  const paid = step.amount && step.amount.value > 0 ? money(step.amount) : null;
  const by = step.account;
  switch (step.type) {
    case "EscrowCreate":
      return {
        title: `${paid ?? "A payment"} locked in escrow for ${step.to ? who(step.to) : "someone"}`,
        facts: [
          ...account("Paid by", by),
          ...account("Held for", step.to),
          ...(step.refundAfter
            ? [
                {
                  label: "The fan can take it back after",
                  value: formatFarTime(step.refundAfter),
                },
              ]
            : []),
        ],
      };
    case "EscrowFinish":
      return {
        title: `${paid ? `${paid} released` : "Payment released"} from escrow to ${who(step.to ?? by)}`,
        facts: [
          ...account("Paid by", step.owner),
          ...account("Released to", step.to ?? by),
        ],
      };
    case "EscrowCancel":
      return {
        title: `${paid ? `${paid} returned` : "Payment returned"} to the fan from escrow`,
        facts: [
          ...account("Returned to", step.owner),
          ...account("Was held for", step.to),
        ],
      };
    case "NFTokenMint":
      return {
        title: "Ticket created by the organizer",
        facts: [
          ...account("Created by", by),
          ...account("Set aside for", step.to),
          ...ticket(step.nftId),
        ],
      };
    case "NFTokenCreateOffer":
      return {
        title: paid
          ? `Ticket put up for sale at ${paid}`
          : "Ticket offered as a gift",
        facts: [...account("Offered by", by), ...ticket(step.nftId)],
      };
    case "NFTokenAcceptOffer":
      return {
        title: paid
          ? `Ticket bought from another fan for ${paid}`
          : "Ticket delivered to the fan",
        facts: [
          ...account("Delivered to", by),
          ...account("Came from", step.owner),
          ...ticket(step.nftId),
          ...mono("Offer taken", step.offerId),
        ],
      };
    case "NFTokenCancelOffer":
      return {
        title: "Ticket taken off sale",
        facts: [
          ...account("Withdrawn by", by),
          ...mono("Offer withdrawn", step.offerId),
        ],
      };
    case "NFTokenBurn":
      return {
        title: "Ticket burned, so it can never be used",
        facts: [
          ...account("Burned by", by),
          ...account("Was held by", step.owner),
          ...ticket(step.nftId),
        ],
      };
    case "Payment":
      return {
        title: `${paid ?? "A payment"} sent to ${step.to ? who(step.to) : "an account"}`,
        facts: [...account("Sent by", by), ...account("Sent to", step.to)],
      };
    case "TrustSet":
      return {
        title: "Account set up to hold test dollars",
        facts: [
          ...account("Account", by),
          ...account("Dollars issued by", step.to),
        ],
      };
    case "CredentialCreate":
      return {
        title: "Verified organizer credential issued",
        facts: [
          ...account("Issued by", by),
          ...account("Issued to", step.to),
          ...(step.page
            ? [{ label: "Official event page", value: step.page }]
            : []),
        ],
      };
    case "CredentialAccept":
      return {
        title: "Verified organizer credential accepted",
        facts: [
          ...account("Accepted by", by),
          ...account("Issued by", step.owner),
        ],
      };
    default:
      return {
        title: "A change on the XRP Ledger",
        facts: account("Made by", by),
      };
  }
}

/** The whole transaction in one line. A Batch is named for what its steps do together. */
function headline(tx: ProofTransaction) {
  if (tx.type !== "Batch") return explain(tx).title;
  const count = (type: string) =>
    tx.parts.filter((part) => part.type === type).length;
  const locked = count("EscrowCreate");
  const taken = count("NFTokenAcceptOffer");
  const released = count("EscrowFinish");
  const burned = count("NFTokenBurn");
  if (locked && taken)
    return "Payment locked in escrow and ticket delivered, in one step";
  const payments =
    released === 1 ? "Payment released" : `${released} payments released`;
  const tickets =
    burned === 1 ? "losing ticket burned" : `${burned} losing tickets burned`;
  if (released && burned)
    return `${payments} to the organizer and ${tickets}, in one step`;
  if (released) return `${payments} to the organizer, in one step`;
  if (burned)
    return `${tickets[0].toUpperCase()}${tickets.slice(1)}, in one step`;
  return "Several changes made in one step";
}

function Missing() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <Empty>
        <EmptyTitle>No transaction found</EmptyTitle>
        <EmptyDescription>
          The XRP Ledger testnet has no transaction with this code, or it could
          not be reached. Check the link and try again.
        </EmptyDescription>
        <EmptyActions>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/events" />}
          >
            Browse events
          </Button>
        </EmptyActions>
      </Empty>
    </main>
  );
}

async function ProofPageContent({
  params,
}: Pick<PageProps<"/proof/[hash]">, "params">) {
  const { hash } = await params;
  await connection();
  const tx = await readTransaction(hash);
  if (!tx) return <Missing />;

  const batch = tx.type === "Batch";
  const steps = batch ? tx.parts : [tx];
  const where = tx.ledgerIndex === null ? "" : ` in ledger ${tx.ledgerIndex}`;
  const when = tx.closedAt ? ` on ${formatTime(tx.closedAt)}` : "";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="title-page">{headline(tx)}</h1>
        <Status
          status={!tx.validated ? "running" : tx.ok ? "done" : "failed"}
          label={
            !tx.validated
              ? "Waiting to be confirmed"
              : `${tx.ok ? "Confirmed" : "Failed"}${where}${when}`
          }
        />
        <p className="text-base leading-normal text-fg-2">
          {!tx.ok
            ? "This did not go through. Nothing moved apart from the fee. "
            : batch
              ? "Every step below happened together. If one had failed, none of them would have happened. "
              : ""}
          Read live from the XRP Ledger testnet when this page opened.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {batch ? `The ${steps.length} steps inside it` : "What it did"}
        </h2>
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => {
            const { title, facts } = explain(step);
            return (
              <li key={`${index}-${step.type}`}>
                <Card variant="outline">
                  {batch && (
                    <CardTitle>
                      {index + 1}. {title}
                    </CardTitle>
                  )}
                  <Facts facts={facts} />
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Details</h2>
        <Card variant="surface">
          <Facts
            facts={[
              {
                label: "Transaction",
                value: <span className="font-mono">{tx.hash}</span>,
              },
              {
                label: "Kind",
                value: <span className="font-mono">{tx.type}</span>,
              },
              ...(tx.ledgerIndex === null
                ? []
                : [
                    {
                      label: "Ledger number",
                      value: (
                        <span className="font-mono">{tx.ledgerIndex}</span>
                      ),
                    },
                  ]),
              {
                label: "Fee",
                value: <span className="font-mono">{tx.fee} XRP</span>,
              },
              {
                label: "Result code",
                value: <span className="font-mono">{tx.result}</span>,
              },
              ...account("Submitted by", tx.account),
            ]}
          />
        </Card>
        <ExplorerLink href={explorerTxUrl(tx.hash)} />
      </section>
    </main>
  );
}

export default function ProofPage({ params }: PageProps<"/proof/[hash]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProofPageContent params={params} />
    </Suspense>
  );
}
