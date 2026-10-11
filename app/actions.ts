"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  MARKETS,
  feeFor,
  getSeat,
  getSide,
  priceFor,
  seats,
  slug,
} from "@/lib/fairseat/data";
import { findEvent } from "@/lib/fairseat/events";
import {
  checkEventPage,
  type Check,
  type SecondOpinion,
} from "@/lib/fairseat/context";
import { loadSide, viewTicket } from "@/lib/fairseat/live";
import {
  DEMO_REFUND_MINUTES,
  RESALE_CAP,
  TICKET_LIMIT,
  formatDeadline,
  refundAfterFor,
  refundDeadline,
  resaleCap,
} from "@/lib/fairseat/rules";
import {
  clearEscrow,
  clearOffer,
  escrowFor,
  findOffer,
  holderOf,
  ledgerSettlement,
  logActivity,
  offerFor,
  quickRefunds,
  recordHolder,
  recordPaid,
  recordSale,
  recordSettlement,
  saveEscrow,
  saveEvent,
  saveOffer,
  setQuickRefunds,
  soldTicket,
  soldTickets,
  stageResult,
  ticketKey,
} from "@/lib/fairseat/store";
import { readWallet, saveWallet } from "@/lib/fairseat/wallet";
import {
  acceptOffer,
  buyTicket,
  cancelOffer,
  createFanWallet,
  listTickets,
  offerTicket,
  organizerAddress,
  refundEscrow,
  settleTickets,
  verifyOrganizer,
} from "@/lib/fairseat/xrpl";
import { allEvents } from "@/lib/fairseat/events";
import { formatAmount } from "@/components/lime/ui/amount";

export type ActionResult = { error: string } | undefined;

const message = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong on the ledger";

async function ensureWallet() {
  const existing = await readWallet();
  if (existing) return existing;
  const wallet = await createFanWallet();
  await saveWallet(wallet);
  return wallet;
}

/** Makes a funded testnet wallet for this browser, if it does not have one yet. */
export async function getTestWallet(): Promise<ActionResult> {
  try {
    await ensureWallet();
  } catch (error) {
    return { error: message(error) };
  }
}

/** Whether a wallet already holds as many tickets for a team in an event as one wallet may. */
async function atLimit(address: string, eventId: string, team: string) {
  // Counted from the ledger, so tickets bought, bought from a fan and claimed all count.
  const held = await listTickets(address);
  return (
    held.filter((item) => item.eventId === eventId && item.team === team)
      .length >= TICKET_LIMIT
  );
}

const limitReached = (team: string) =>
  `You already hold ${TICKET_LIMIT} ${team} tickets for this event. That is the limit.`;

/** Buys one team's ticket for a seat at the live price, on the ledger. */
export async function buyTeamTicket(
  eventId: string,
  seatId: string,
  team: string,
): Promise<ActionResult> {
  let nftId: string;
  let hash: string;
  try {
    const event = findEvent(eventId);
    const seat = event && getSeat(event, seatId);
    const config = event && seat && getSide(event, seat.side);
    if (!event || !seat || !config)
      return { error: "That seat does not exist" };

    // The price is worked out here from the live market, never taken from the browser.
    const side = await loadSide(config);
    const outcome = side.onSale.find((item) => item.slug === team);
    if (!outcome) return { error: "That ticket is no longer on sale" };

    const key = ticketKey(eventId, seatId, team);
    const taken = soldTicket(key);
    if (taken) {
      // Already sold once, so it can only be bought from its holder, at the price they listed.
      const offer = offerFor(taken);
      if (!offer || offer.price <= 0)
        return {
          error: `The ${outcome.team} ticket for this seat has already been sold`,
        };
      const wallet = await ensureWallet();
      if (wallet.address === offer.from)
        return { error: "This is your own listing" };
      if (await atLimit(wallet.address, eventId, team))
        return { error: limitReached(outcome.team) };
      ({ hash } = await acceptOffer(wallet.seed, offer.offerId));
      nftId = taken;
      clearOffer(taken);
      recordPaid(taken, offer.price);
      recordHolder(taken, wallet.address);
      logActivity({
        kind: "resold",
        nftId,
        eventId,
        seatId,
        team,
        amount: offer.price,
        hash,
        from: wallet.address,
        to: offer.from,
      });
    } else {
      const price = priceFor(seat, outcome.share);
      const wallet = await ensureWallet();
      if (await atLimit(wallet.address, eventId, team))
        return { error: limitReached(outcome.team) };
      const paid = price + feeFor(price);
      // If the money is never released, the fan can take it back a month after the event.
      // The demo switch brings that forward to a few minutes from now, so a refund can be shown.
      const quick = quickRefunds();
      const refundAfter = quick
        ? new Date(Date.now() + DEMO_REFUND_MINUTES * 60_000)
        : refundDeadline(event.date);
      const bought = await buyTicket(
        wallet.seed,
        { eventId, seatId, team, paid },
        refundAfter,
      );
      ({ nftId, hash } = bought);
      saveEscrow(nftId, {
        ...bought.escrow,
        amount: paid,
        ...(quick && { refundAfter: refundAfter.toISOString() }),
      });
      recordHolder(nftId, wallet.address);
      const ticket = { nftId, eventId, seatId, team };
      logActivity(
        { ...ticket, kind: "minted", hash: bought.mintHash },
        {
          ...ticket,
          kind: "bought",
          amount: paid,
          hash,
          from: wallet.address,
          to: organizerAddress(),
        },
      );
      recordSale(key, nftId);
    }
  } catch (error) {
    return { error: message(error) };
  }
  // The header now outlives the page, so ask for it again to show the new balance.
  revalidatePath("/", "layout");
  redirect(`/tickets/${nftId}?bought=${hash}`);
}

/** The caller's wallet and the ticket in it, or the reason there is none. */
async function heldTicket(nftId: string) {
  const wallet = await readWallet();
  const ticket =
    wallet &&
    (await listTickets(wallet.address)).find((item) => item.nftId === nftId);
  return wallet && ticket ? { wallet, ticket } : null;
}

/** Offers a held ticket on the ledger: for sale at a price, or as a gift when the price is 0. */
export async function offerHeldTicket(
  nftId: string,
  price: number,
): Promise<ActionResult> {
  try {
    if (!Number.isFinite(price) || price < 0 || price > 100_000)
      return { error: "Enter a price between $0 and $100,000" };
    const held = await heldTicket(nftId);
    if (!held) return { error: "That ticket is not in your wallet" };
    if (offerFor(nftId)) return { error: "This ticket already has an offer" };
    const amount = Math.round(price * 100) / 100;
    if (amount > 0) {
      // The cap follows the live price, so it is worked out here and never taken from the browser.
      const view = await viewTicket(
        { id: nftId, ...held.ticket },
        findEvent(held.ticket.eventId),
      );
      if (!view)
        return { error: "The seat for that ticket could not be found" };
      const cap = resaleCap(view.worth);
      if (amount > cap)
        return {
          error: `The most you can ask is ${formatAmount(cap)}. That is ${Math.round(RESALE_CAP * 100)}% of what this ticket costs new right now.`,
        };
    }
    const { offerId, hash } = await offerTicket(
      held.wallet.seed,
      nftId,
      amount,
    );
    logActivity({
      kind: amount > 0 ? "listed" : "sent",
      nftId,
      eventId: held.ticket.eventId,
      seatId: held.ticket.seatId,
      team: held.ticket.team,
      amount: amount > 0 ? amount : undefined,
      hash,
      from: held.wallet.address,
    });
    saveOffer(nftId, {
      offerId,
      price: amount,
      from: held.wallet.address,
      eventId: held.ticket.eventId,
      seatId: held.ticket.seatId,
      team: held.ticket.team,
    });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/", "layout");
}

/** Withdraws the open offer on a held ticket. */
export async function withdrawOffer(nftId: string): Promise<ActionResult> {
  try {
    const wallet = await readWallet();
    const offer = offerFor(nftId);
    if (!wallet || !offer || offer.from !== wallet.address)
      return { error: "There is no offer of yours on this ticket" };
    const { hash } = await cancelOffer(wallet.seed, offer.offerId);
    clearOffer(nftId);
    logActivity({
      kind: "unlisted",
      nftId,
      eventId: offer.eventId,
      seatId: offer.seatId,
      team: offer.team,
      hash,
      from: wallet.address,
    });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/", "layout");
}

/** Takes a ticket a friend sent, into this browser's wallet. */
export async function claimTicket(offerId: string): Promise<ActionResult> {
  let nftId: string;
  let hash: string;
  try {
    const offer = findOffer(offerId);
    if (!offer || offer.price !== 0)
      return { error: "This ticket is no longer waiting to be claimed" };
    const wallet = await ensureWallet();
    if (wallet.address === offer.from)
      return {
        error:
          "You sent this ticket. Open the link in another browser to claim it.",
      };
    if (await atLimit(wallet.address, offer.eventId, offer.team)) {
      const view = await viewTicket(
        { id: offer.nftId, ...offer, paid: 0 },
        findEvent(offer.eventId),
      );
      return { error: limitReached(view?.outcome.team ?? offer.team) };
    }
    ({ hash } = await acceptOffer(wallet.seed, offer.offerId));
    nftId = offer.nftId;
    clearOffer(nftId);
    recordPaid(nftId, 0);
    recordHolder(nftId, wallet.address);
    logActivity({
      kind: "claimed",
      nftId,
      eventId: offer.eventId,
      seatId: offer.seatId,
      team: offer.team,
      hash,
      from: offer.from,
      to: wallet.address,
    });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/", "layout");
  redirect(`/tickets/${nftId}?claimed=${hash}`);
}

/**
 * Gives a fan back a payment that was never released to the organizer. Only the wallet that paid
 * can ask, only while the payment is still locked, and only once its deadline has passed.
 */
export async function takeRefund(nftId: string): Promise<ActionResult> {
  try {
    const wallet = await readWallet();
    const escrow = escrowFor(nftId);
    if (!wallet || !escrow || escrow.owner !== wallet.address)
      return { error: "There is no payment of yours locked for this ticket" };
    const ticket = soldTickets().find((item) => item.nftId === nftId);
    const event = ticket && findEvent(ticket.eventId);
    if (!ticket || !event)
      return { error: "The event for that ticket could not be found" };
    const after = refundAfterFor(escrow, event.date);
    const now = new Date();
    if (now < after)
      return {
        error: `This payment can be taken back from ${formatDeadline(after, now)}`,
      };
    let hash: string;
    try {
      ({ hash } = await refundEscrow(wallet.seed, escrow));
    } catch (error) {
      // The ledger keeps its own clock, a few seconds behind this one.
      if (message(error).includes("tecNO_PERMISSION"))
        return {
          error:
            "The ledger has not reached the refund time yet. Try again in a few seconds.",
        };
      throw error;
    }
    clearEscrow(nftId);
    logActivity({
      ...ticket,
      kind: "refunded",
      amount: escrow.amount,
      hash,
      to: wallet.address,
    });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/", "layout");
}

/** Demo only: makes new purchases refundable after a few minutes, so the refund can be shown. */
export async function stageQuickRefunds(on: boolean): Promise<void> {
  setQuickRefunds(on);
  revalidatePath("/", "layout");
}

/** Demo only: says a team made the final, as the market will when it settles. Null undoes it. */
export async function stageSettlement(
  ticker: string,
  team: string | null,
): Promise<void> {
  stageResult(ticker, team);
  revalidatePath("/", "layout");
}

export type NewEvent = {
  name: string;
  date: string;
  venue: string;
  link: string;
  market: string;
  section: string;
  price: number;
};

export type PublishResult =
  | { error: string }
  | {
      checks: Check[];
      independent: SecondOpinion[];
      page: string;
      owner: string | null;
      eventId: string | null;
    };

/** Checks an organizer's event against its official page and, if every detail matches, puts it on sale. */
export async function publishEvent(input: NewEvent): Promise<PublishResult> {
  const name = input.name.trim();
  const venue = input.venue.trim();
  const market = MARKETS[input.market];
  if (!name || !venue || !/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    return { error: "Fill in the event name, date and venue" };
  if (!market) return { error: "Choose a Gemini market" };
  if (!(input.price > 0) || input.price > 100_000)
    return { error: "Enter a full seat price between $1 and $100,000" };
  const ring = market.map.rings[0];
  const section = Number(input.section);
  if (
    !Number.isInteger(section) ||
    section < ring.first ||
    section >= ring.first + ring.count
  )
    return {
      error: `Enter a section from ${ring.first} to ${ring.first + ring.count - 1}`,
    };
  const id = `${slug(name)}-${input.date}`;
  if (findEvent(id)) return { error: "This event is already listed" };

  const result = await checkEventPage(input.link, {
    name,
    date: input.date,
    venue,
  });
  if ("error" in result) return result;
  const report = {
    checks: result.checks,
    independent: result.independent,
    page: result.page,
    owner: result.owner,
  };
  if (!result.ok) return { ...report, eventId: null };

  saveEvent({
    id,
    title: name,
    sport: market.sport,
    date: input.date,
    venue,
    city: "",
    officialUrl: input.link,
    map: market.map,
    sides: [{ id: "side", name: market.side, market: input.market }],
    seats: seats("side", String(section), Math.round(input.price * 100) / 100),
    checkedAgainst: result.page,
  });
  // The pass is written to the ledger as a credential. The event is on sale whether or not that works.
  await verifyOrganizer(input.link).catch(() => undefined);
  revalidatePath("/", "layout");
  return { ...report, eventId: id };
}

export type LedgerSettlement =
  | { error: string }
  | { released: number; dollars: number; burned: number; hashes: string[] };

/**
 * Settles one market on the ledger once its finalist is known: every payment held for that side is
 * released to the organizer, and the tickets for teams that missed out are burned. This cannot be undone.
 */
export async function settleOnLedger(
  ticker: string,
): Promise<LedgerSettlement> {
  try {
    if (ledgerSettlement(ticker))
      return { error: "This side is already settled on the ledger" };
    const event = allEvents().find((item) =>
      item.sides.some((side) => side.market === ticker),
    );
    const config = event?.sides.find((side) => side.market === ticker);
    const side = config && (await loadSide(config));
    if (!side?.settled) return { error: "The finalist is not decided yet" };
    const winner = slug(side.settled);

    // Every ticket sold for a seat on this side, in any event priced by this market.
    const tickets = soldTickets().flatMap((ticket) => {
      const seat = findEvent(ticket.eventId)?.seats.find(
        (item) => item.id === ticket.seatId,
      );
      const market = findEvent(ticket.eventId)?.sides.find(
        (item) => item.id === seat?.side,
      )?.market;
      if (market !== ticker) return [];
      const escrow = escrowFor(ticket.nftId);
      return [
        {
          nftId: ticket.nftId,
          about: ticket,
          escrow,
          burnFrom: ticket.team === winner ? null : holderOf(ticket.nftId),
        },
      ];
    });
    const { hashes, byTicket } = await settleTickets(tickets);
    const released = tickets.filter((ticket) => ticket.escrow);
    const burned = tickets.filter((ticket) => ticket.burnFrom);
    recordSettlement(
      ticker,
      hashes,
      released.map((ticket) => ticket.nftId),
      burned.map((ticket) => ticket.nftId),
    );
    logActivity(
      ...released.map((ticket) => ({
        ...ticket.about,
        kind: "released" as const,
        amount: ticket.escrow?.amount,
        hash: byTicket[ticket.nftId],
        from: ticket.escrow?.owner,
        to: organizerAddress(),
      })),
      ...burned.map((ticket) => ({
        ...ticket.about,
        kind: "burned" as const,
        hash: byTicket[ticket.nftId],
        from: ticket.burnFrom ?? undefined,
      })),
    );
    revalidatePath("/", "layout");
    return {
      released: released.length,
      dollars: released.reduce(
        (sum, ticket) => sum + (ticket.escrow?.amount ?? 0),
        0,
      ),
      burned: burned.length,
      hashes,
    };
  } catch (error) {
    return { error: message(error) };
  }
}
