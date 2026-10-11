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
import { loadSide } from "@/lib/fairseat/live";
import { readTeam, saveTeam, teamName } from "@/lib/fairseat/team";
import {
  clearOffer,
  escrowFor,
  findOffer,
  holderOf,
  ledgerSettlement,
  logActivity,
  offerFor,
  recordHolder,
  recordPaid,
  recordReleases,
  recordSale,
  recordSettlement,
  releasedTicket,
  releasedTickets,
  saveEscrow,
  saveEvent,
  saveOffer,
  soldTicket,
  soldTickets,
  stageResult,
  ticketKey,
} from "@/lib/fairseat/store";
import { readWallet, saveWallet } from "@/lib/fairseat/wallet";
import {
  acceptOffer,
  buyReleasedTicket,
  buyTicket,
  cancelOffer,
  createFanWallet,
  listTickets,
  offerTicket,
  organizerAddress,
  releaseTickets,
  setUpTeamOrganizer,
  settleTickets,
  teamOrganizerAddress,
  type Purchase,
} from "@/lib/fairseat/xrpl";
import { allEvents } from "@/lib/fairseat/events";

export type ActionResult = { error: string } | undefined;

/** How long after the event a fan must wait before taking back a payment that was never released. */
const REFUND_DAYS = 30;

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
      // Where teams sell their own tickets, one is on sale only once its team has released it.
      const released = event.teamWallets ? releasedTicket(key) : null;
      if (event.teamWallets && !released)
        return { error: `${outcome.team} have not released this ticket yet` };
      const price = priceFor(seat, outcome.share);
      const wallet = await ensureWallet();
      const paid = price + feeFor(price);
      // If the money is never released, the fan can take it back a month after the event.
      const refundAfter = new Date(`${event.date}T12:00:00Z`);
      refundAfter.setUTCDate(refundAfter.getUTCDate() + REFUND_DAYS);
      const ticket = { eventId, seatId, team };
      const bought: Omit<Purchase, "mintHash"> & { mintHash?: string } =
        released
          ? await buyReleasedTicket(
              wallet.seed,
              team,
              released,
              paid,
              refundAfter,
            )
          : await buyTicket(wallet.seed, { ...ticket, paid }, refundAfter);
      ({ nftId, hash } = bought);
      saveEscrow(nftId, { ...bought.escrow, amount: paid });
      recordHolder(nftId, wallet.address);
      // A released ticket was minted before its price was known, so what was paid is kept here.
      if (released) recordPaid(nftId, paid);
      logActivity(
        ...(bought.mintHash
          ? [
              {
                ...ticket,
                nftId,
                kind: "minted" as const,
                hash: bought.mintHash,
              },
            ]
          : []),
        {
          ...ticket,
          nftId,
          kind: "bought",
          amount: paid,
          hash,
          from: wallet.address,
          to: released ? teamOrganizerAddress(team) : organizerAddress(),
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

/** Picks the team this browser organizes for. */
export async function chooseTeam(team: string): Promise<void> {
  if (!teamName(team)) return;
  await saveTeam(team);
  revalidatePath("/", "layout");
}

/**
 * Releases the organizer's team's tickets for every seat it has not yet released in one section.
 * They are minted on the ledger from the team's own organizer wallet, which is set up on first use.
 */
export async function releaseSection(
  eventId: string,
  section: string,
): Promise<ActionResult> {
  try {
    const team = await readTeam();
    const event = findEvent(eventId);
    if (!event?.teamWallets)
      return { error: "This event's tickets are not released by its teams" };
    // A team has tickets only for the seats on its own side.
    const sides = await Promise.all(event.sides.map(loadSide));
    const side = sides.find((item) =>
      item.outcomes.some((outcome) => outcome.slug === team),
    );
    if (!side) return { error: "That team is not in this event" };
    if (side.settled) return { error: "The finalist is already decided" };
    const records = event.seats
      .filter((seat) => seat.side === side.id && seat.section === section)
      .filter((seat) => !releasedTicket(ticketKey(eventId, seat.id, team)))
      .map((seat) => ({ eventId, seatId: seat.id, team, paid: 0 }));
    if (records.length === 0)
      return { error: "Every ticket in this section is already released" };

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
    const tickets = sold.map((ticket) => ({
      nftId: ticket.nftId,
      about: ticket,
      escrow: escrowFor(ticket.nftId),
      burnFrom: ticket.team === winner ? null : holderOf(ticket.nftId),
    }));
    // A ticket a team released that nobody bought is still in its organizer's account, and expires too.
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

    // Tickets a team released are settled by that team's own organizer, one team at a time.
    const hashes: string[] = [];
    const byTicket: Record<string, string> = {};
    const teams = event?.teamWallets
      ? [...new Set(tickets.map((ticket) => ticket.about.team))]
      : [undefined];
    for (const team of teams) {
      const done = await settleTickets(
        team ? tickets.filter((ticket) => ticket.about.team === team) : tickets,
        team,
      );
      hashes.push(...done.hashes);
      Object.assign(byTicket, done.byTicket);
    }
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
        to: event?.teamWallets
          ? teamOrganizerAddress(ticket.about.team)
          : organizerAddress(),
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
