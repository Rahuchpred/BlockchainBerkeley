import { connection } from "next/server";
import { Suspense } from "react";
import {
  Empty,
  EmptyActions,
  EmptyDescription,
  EmptyTitle,
} from "@/components/lime/ui/empty";
import { formatDate, getEvent, seatLabel } from "@/lib/fairseat/data";
import { viewTicket } from "@/lib/fairseat/live";
import { qrShape } from "@/lib/fairseat/qr";
import { readWallet } from "@/lib/fairseat/wallet";
import { listTickets } from "@/lib/fairseat/xrpl";
import { PageSkeleton } from "../_components/page-skeleton";
import { TicketWallet, type WalletTicket } from "../_components/ticket-wallet";
import { WalletChip } from "../_components/wallet-chip";

async function Wallet() {
  await connection();
  const wallet = await readWallet();
  const held = wallet ? await listTickets(wallet.address) : [];
  const views = await Promise.all(
    held.map((ticket) =>
      viewTicket(
        {
          id: ticket.nftId,
          eventId: ticket.eventId,
          seatId: ticket.seatId,
          team: ticket.team,
          paid: ticket.paid,
        },
        getEvent(ticket.eventId),
      ),
    ),
  );
  const tickets = views.flatMap((view): WalletTicket[] => {
    if (!view) return [];
    return [
      {
        id: view.ticket.id,
        status: view.status,
        team: view.outcome.team,
        image: view.outcome.image,
        event: view.event.title,
        date: formatDate(view.event.date),
        place: `${view.event.venue}, ${view.event.city}`,
        seat: seatLabel(view.seat),
        worth: view.worth,
        qr:
          view.status === "live"
            ? qrShape(`fairseat:${view.ticket.id}`)
            : undefined,
      },
    ];
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 sm:pt-8">
      <h1 className="title-page">My tickets</h1>
      {!wallet ? (
        <Empty>
          <EmptyTitle>No wallet yet</EmptyTitle>
          <EmptyDescription>
            Tickets live in a wallet on the XRP Ledger testnet. A test wallet
            comes with $5,000 in test dollars to buy with.
          </EmptyDescription>
          <EmptyActions>
            <WalletChip balance={null} />
          </EmptyActions>
        </Empty>
      ) : (
        <TicketWallet tickets={tickets} />
      )}
    </main>
  );
}

export default function TicketsPage() {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <Wallet />
      </Suspense>
    </>
  );
}
