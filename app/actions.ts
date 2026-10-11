"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  MARKETS,
  type FairEvent,
  type Seat,
  feeFor,
  getSeat,
  getSide,
  openSeat,
  priceFor,
  seatLabel,
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
  HOME,
  accountFor,
  clearSession,
  readSession,
  saveSession,
} from "@/lib/fairseat/session";
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
  forgetRelease,
  forgetTicket,
  holderOf,
  ledgerSettlement,
  logActivity,
  offerFor,
  quickRefunds,
  recordHolder,
  recordPaid,
  recordReleases,
  recordSale,
  recordSettled,
  recordSettlement,
  releasedTicket,
  releasedTickets,
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
  GROUP_LIMIT,
  acceptOffer,
  burnTicket,
  buyReleasedTicket,
  buyTickets,
  cancelOffer,
  createFanWallet,
  listTickets,
  offerTicket,
  organizerAddress,
  refundEscrow,
  releaseTickets,
  setUpTeamOrganizer,
  settleTickets,
  teamOrganizerAddress,
  verifyOrganizer,
  type Settled,
  type Settlement,
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

/** Whether taking more tickets for a team in an event would put a wallet over what one may hold. */
async function atLimit(
  address: string,
  eventId: string,
  team: string,
  buying = 1,
) {
  // Counted from the ledger, so tickets bought, bought from a fan and claimed all count.
  const held = await listTickets(address);
  return (
    held.filter((item) => item.eventId === eventId && item.team === team)
      .length +
      buying >
    TICKET_LIMIT
  );
}

const limitReached = (team: string) =>
  `You already hold ${TICKET_LIMIT} ${team} tickets for this event. That is the limit.`;

/**
 * Sells new tickets for one team to one wallet, a ticket for each seat, paid for together on the
 * ledger, and records each sale. Returns the first ticket and the payment.
 */
async function sellNew(
  wallet: { seed: string; address: string },
  event: FairEvent,
  group: Seat[],
  outcome: { slug: string; share: number },
) {
  const team = outcome.slug;
  const records = group.map((seat) => {
    const price = priceFor(seat, outcome.share);
    return {
      eventId: event.id,
      seatId: seat.id,
      team,
      paid: price + feeFor(price),
    };
  });
  // If the money is never released, the fan can take it back a month after the event.
  // The demo switch brings that forward to a few minutes from now, so a refund can be shown.
  const quick = quickRefunds();
  const refundAfter = quick
    ? new Date(Date.now() + DEMO_REFUND_MINUTES * 60_000)
    : refundDeadline(event.date);
  const bought = await buyTickets(wallet.seed, records, refundAfter);
  for (const [at, { nftId, hash, mintHash, escrow }] of bought.entries()) {
    const { eventId, seatId, paid } = records[at];
    saveEscrow(nftId, {
      ...escrow,
      amount: paid,
      ...(quick && { refundAfter: refundAfter.toISOString() }),
    });
    recordHolder(nftId, wallet.address);
    const ticket = { nftId, eventId, seatId, team };
    logActivity(
      { ...ticket, kind: "minted", hash: mintHash },
      {
        ...ticket,
        kind: "bought",
        amount: paid,
        hash,
        from: wallet.address,
        to: organizerAddress(),
      },
    );
    recordSale(ticketKey(eventId, seatId, team), nftId);
  }
  return { nftId: bought[0].nftId, hash: bought[0].hash };
}

/**
 * Sells a ticket its club has released to one wallet, paid into that club's own wallet on the
 * ledger, and records the sale. Returns the ticket and the payment.
 */
async function sellReleased(
  wallet: { seed: string; address: string },
  event: FairEvent,
  seat: Seat,
  outcome: { slug: string; share: number },
  nftId: string,
) {
  const team = outcome.slug;
  const price = priceFor(seat, outcome.share);
  const paid = price + feeFor(price);
  const quick = quickRefunds();
  const refundAfter = quick
    ? new Date(Date.now() + DEMO_REFUND_MINUTES * 60_000)
    : refundDeadline(event.date);
  const { hash, escrow } = await buyReleasedTicket(
    wallet.seed,
    team,
    nftId,
    paid,
    refundAfter,
  );
  saveEscrow(nftId, {
    ...escrow,
    amount: paid,
    ...(quick && { refundAfter: refundAfter.toISOString() }),
  });
  recordHolder(nftId, wallet.address);
  // A released ticket was minted before its price was known, so what was paid is kept here.
  recordPaid(nftId, paid);
  logActivity({
    nftId,
    eventId: event.id,
    seatId: seat.id,
    team,
    kind: "bought",
    amount: paid,
    hash,
    from: wallet.address,
    to: teamOrganizerAddress(team),
  });
  recordSale(ticketKey(event.id, seat.id, team), nftId);
  return { nftId, hash };
}

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
    if ((await readSession())?.kind !== "buyer")
      return { error: "Log in as a buyer to buy a ticket" };

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
      const wallet = await ensureWallet();
      if (await atLimit(wallet.address, eventId, team))
        return { error: limitReached(outcome.team) };
      if (event.teamWallets) {
        // Where clubs sell their own tickets, one is on sale only once its club has released it.
        const released = releasedTicket(key);
        if (!released)
          return { error: `${outcome.team} have not released this ticket yet` };
        ({ nftId, hash } = await sellReleased(
          wallet,
          event,
          seat,
          outcome,
          released,
        ));
      } else ({ nftId, hash } = await sellNew(wallet, event, [seat], outcome));
    }
  } catch (error) {
    return { error: message(error) };
  }
  // The header now outlives the page, so ask for it again to show the new balance.
  revalidatePath("/", "layout");
  redirect(`/tickets/${nftId}?bought=${hash}`);
}

/** Demo login: opens the account a username belongs to. There is no password. */
export async function logIn(username: string): Promise<ActionResult> {
  const account = accountFor(username);
  const session = account && (await saveSession(account));
  if (!session) return { error: "There is no account with that username" };
  revalidatePath("/", "layout");
  redirect(HOME[session.kind]);
}

export async function logOut(): Promise<void> {
  await clearSession();
  revalidatePath("/", "layout");
  redirect("/login");
}

/** The most seats one release mints. Each eight are one Batch on the ledger. */
const RELEASE_LIMIT = 32;

/**
 * Releases the logged-in team's tickets for the seats it picked, anywhere on its side of the arena.
 * They are minted on the ledger from the team's own organizer wallet, which is set up on first use.
 */
export async function releaseSeats(
  eventId: string,
  seatIds: string[],
): Promise<ActionResult> {
  try {
    const session = await readSession();
    if (session?.kind !== "team")
      return { error: "Log in as a team's organizer to release tickets" };
    const { team } = session;
    const event = findEvent(eventId);
    if (!event?.teamWallets || !event.ringPrices)
      return { error: "This event's tickets are not released by its teams" };
    const picked = [...new Set(seatIds)];
    if (picked.length === 0) return { error: "Pick at least one seat" };
    if (picked.length > RELEASE_LIMIT)
      return { error: `Release up to ${RELEASE_LIMIT} seats at a time` };
    // A team has tickets only for the seats on its own side.
    const sides = await Promise.all(event.sides.map(loadSide));
    const side = sides.find((item) =>
      item.outcomes.some((outcome) => outcome.slug === team),
    );
    if (!side) return { error: "That team is not in this event" };
    if (side.settled) return { error: "The finalist is already decided" };
    // The seats are checked here against the arena, never trusted from the browser.
    const seats = picked.map((id) => openSeat(event, id));
    if (seats.some((seat) => seat?.side !== side.id))
      return { error: "Pick seats on your own team's side of the arena" };
    const records = picked
      .filter((id) => !releasedTicket(ticketKey(eventId, id, team)))
      .map((seatId) => ({ eventId, seatId, team, paid: 0 }));
    if (records.length === 0)
      return { error: "Those tickets are already released" };

    await setUpTeamOrganizer(team);
    const released = await releaseTickets(team, records);
    recordReleases(
      released.map(({ record, nftId }) => ({
        key: ticketKey(eventId, record.seatId, team),
        nftId,
      })),
    );
    logActivity(
      ...released.map(({ record, nftId, hash }) => ({
        kind: "minted" as const,
        nftId,
        eventId,
        seatId: record.seatId,
        team,
        hash,
      })),
    );
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/", "layout");
}

/**
 * Buys one team's tickets for seats next to each other, at the live price, in one payment on the
 * ledger: the fan gets every ticket or none. One seat is an ordinary purchase.
 */
export async function buyTeamTickets(
  eventId: string,
  seatIds: string[],
  team: string,
): Promise<ActionResult> {
  if (!Array.isArray(seatIds) || seatIds.length < 1)
    return { error: "That seat does not exist" };
  if (seatIds.length === 1) return buyTeamTicket(eventId, seatIds[0], team);
  try {
    if ((await readSession())?.kind !== "buyer")
      return { error: "Log in as a buyer to buy a ticket" };
    if (seatIds.length > GROUP_LIMIT)
      return { error: `You can buy up to ${GROUP_LIMIT} seats together` };
    const event = findEvent(eventId);
    const group = seatIds
      .map((seatId) => event && getSeat(event, seatId))
      .filter((seat) => seat !== undefined && seat !== null)
      .sort((a, b) => Number(a.seat) - Number(b.seat));
    const config = event && group[0] && getSide(event, group[0].side);
    if (
      !event ||
      !config ||
      group.length !== seatIds.length ||
      new Set(seatIds).size !== seatIds.length
    )
      return { error: "That seat does not exist" };
    // A club's released tickets are each offered by the club, so they are paid for one at a time.
    if (event.teamWallets)
      return { error: "Tickets for this event are bought one seat at a time" };
    // Together means the same side, section and row, with no seat skipped.
    const together = group.every(
      (seat, at) =>
        seat.side === group[0].side &&
        seat.section === group[0].section &&
        seat.row === group[0].row &&
        Number(seat.seat) === Number(group[0].seat) + at,
    );
    if (!together) return { error: "Those seats are not next to each other" };

    // The price is worked out here from the live market, never taken from the browser.
    const side = await loadSide(config);
    const outcome = side.onSale.find((item) => item.slug === team);
    if (!outcome) return { error: "That ticket is no longer on sale" };

    // A ticket that was sold once is never part of a group, even while its holder has it listed.
    const taken = group.find((seat) =>
      soldTicket(ticketKey(eventId, seat.id, team)),
    );
    if (taken)
      return {
        error: `The ${outcome.team} ticket for ${seatLabel(taken).toLowerCase()} has already been sold`,
      };
    const wallet = await ensureWallet();
    if (await atLimit(wallet.address, eventId, team, group.length))
      return {
        error: `One wallet can hold up to ${TICKET_LIMIT} ${outcome.team} tickets for this event. These ${group.length} would take you over that.`,
      };
    await sellNew(wallet, event, group, outcome);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/", "layout");
  redirect("/tickets");
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
 * Gives a fan back a payment that was never released to the organizer, and takes the ticket back
 * in return: it is burned and its seat goes on sale again. Only the wallet that paid can ask, only
 * while it still holds the ticket and the payment is still locked, and only once the deadline has
 * passed. With `leave`, the fan is sent to their tickets afterwards, as the ticket's page is gone.
 */
export async function takeRefund(
  nftId: string,
  leave = false,
): Promise<ActionResult> {
  let unburned = false;
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
    // The money comes back only in exchange for the ticket. A fan who sold it or gave it away has
    // nothing to hand back, so their payment stays where it is.
    if (!(await heldTicket(nftId)))
      return {
        error:
          "You no longer hold this ticket, so its payment cannot be taken back.",
      };
    let hash: string;
    try {
      // This also confirms on the ledger that the escrow is gone, before the ticket is touched.
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
    const burn = await burnTicket(
      nftId,
      wallet.address,
      event.teamWallets ? ticket.team : undefined,
    ).catch(() => null);
    if (burn) {
      logActivity({
        ...ticket,
        kind: "burned",
        returned: true,
        hash: burn.hash,
        from: wallet.address,
      });
      // The sale is forgotten, so this team's ticket for the seat can be bought again. Where
      // clubs sell their own, the club has to release a new one first.
      forgetTicket(nftId);
      forgetRelease(nftId);
    } else unburned = true;
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/", "layout");
  if (unburned)
    return {
      error:
        "Your money is back, but the ticket could not be removed from the ledger. The seat stays marked as sold.",
    };
  if (leave) redirect("/tickets");
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
    sides: [
      {
        id: "side",
        name: market.side,
        market: input.market,
        ...(market.condition && { condition: market.condition }),
      },
    ],
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
    const marketOf = (ticket: { eventId: string; seatId: string }) => {
      const seat = findEvent(ticket.eventId)?.seats.find(
        (item) => item.id === ticket.seatId,
      );
      return findEvent(ticket.eventId)?.sides.find(
        (item) => item.id === seat?.side,
      )?.market;
    };

    // Every ticket sold for a seat on this side, in any event priced by this market.
    const sold = soldTickets().filter((ticket) => marketOf(ticket) === ticker);
    const tickets: (Omit<Settlement, "escrow"> & {
      about: (typeof sold)[number];
      escrow: ReturnType<typeof escrowFor>;
    })[] = sold.map((ticket) => ({
      nftId: ticket.nftId,
      about: ticket,
      escrow: escrowFor(ticket.nftId),
      burnFrom: ticket.team === winner ? null : holderOf(ticket.nftId),
    }));
    // A ticket a club released that nobody bought is still in its own account, and expires too.
    const unsold = releasedTickets()
      .filter((ticket) => marketOf(ticket) === ticker && ticket.team !== winner)
      .filter((ticket) => !sold.some((item) => item.nftId === ticket.nftId))
      .map((ticket) => ({
        nftId: ticket.nftId,
        about: ticket,
        escrow: null,
        burnFrom: teamOrganizerAddress(ticket.team),
      }));
    tickets.push(...unsold);

    // What happened is read back from the ledger for each ticket, and only that is recorded.
    // Tickets a club released are settled by that club's own wallet, one club at a time.
    const hashes: string[] = [];
    const outcomes: Settled[] = [];
    const teams = event?.teamWallets
      ? [...new Set(tickets.map((ticket) => ticket.about.team))]
      : [undefined];
    for (const team of teams) {
      const done = await settleTickets(
        team ? tickets.filter((ticket) => ticket.about.team === team) : tickets,
        team,
      );
      hashes.push(...done.hashes);
      outcomes.push(...done.tickets);
    }
    const outcome = new Map(outcomes.map((item) => [item.nftId, item]));
    const released = tickets.filter(
      (ticket) => outcome.get(ticket.nftId)?.release === "done",
    );
    const burned = tickets.filter(
      (ticket) => outcome.get(ticket.nftId)?.burn === "done",
    );
    // A payment the ledger no longer holds was released or taken back some other way. Its record
    // is dropped, since there is nothing left to release, but it is not counted as released here.
    const missing = tickets.filter(
      (ticket) => outcome.get(ticket.nftId)?.release === "gone",
    );
    recordSettled(
      [...released, ...missing].map((ticket) => ticket.nftId),
      burned.map((ticket) => ticket.nftId),
    );
    logActivity(
      ...released.map((ticket) => ({
        ...ticket.about,
        kind: "released" as const,
        amount: ticket.escrow?.amount,
        hash: outcome.get(ticket.nftId)?.releaseHash,
        from: ticket.escrow?.owner,
        to: event?.teamWallets
          ? teamOrganizerAddress(ticket.about.team)
          : organizerAddress(),
      })),
      ...burned.map((ticket) => ({
        ...ticket.about,
        kind: "burned" as const,
        hash: outcome.get(ticket.nftId)?.burnHash,
        from: ticket.burnFrom ?? undefined,
      })),
    );
    revalidatePath("/", "layout");

    const count = (n: number, one: string, many: string) =>
      `${n} ${n === 1 ? one : many}`;
    const unreleased = outcomes.filter((item) => item.release === "failed");
    const unburned = outcomes.filter((item) => item.burn === "failed");
    const problems = [
      unreleased.length &&
        `${count(unreleased.length, "payment was", "payments were")} not released and ${unreleased.length === 1 ? "is" : "are"} still locked`,
      missing.length &&
        `${count(missing.length, "payment was", "payments were")} not released because the ledger no longer holds ${missing.length === 1 ? "it" : "them"}`,
      unburned.length &&
        `${count(unburned.length, "expired ticket was", "expired tickets were")} not burned`,
    ].filter(Boolean);
    if (problems.length) {
      const why = [...unreleased, ...unburned].find((item) => item.why)?.why;
      return {
        error: `This side is not settled yet: ${problems.join(", ")}. ${released.length ? `${count(released.length, "payment was", "payments were")} released. ` : ""}Run it again.${why ? ` The ledger said: ${why}` : ""}`,
      };
    }
    recordSettlement(ticker, hashes);
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
