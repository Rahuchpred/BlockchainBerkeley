"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  feeFor,
  getEvent,
  getSeat,
  getSide,
  priceFor,
} from "@/lib/fairseat/data";
import { loadSide } from "@/lib/fairseat/live";
import {
  clearOffer,
  findOffer,
  offerFor,
  recordPaid,
  recordSale,
  saveOffer,
  soldTicket,
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
} from "@/lib/fairseat/xrpl";

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

/** Buys one team's ticket for a seat at the live price, on the ledger. */
export async function buyTeamTicket(
  eventId: string,
  seatId: string,
  team: string,
): Promise<ActionResult> {
  let nftId: string;
  let hash: string;
  try {
    const event = getEvent(eventId);
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
    } else {
      const price = priceFor(seat, outcome.share);
      const wallet = await ensureWallet();
      ({ nftId, hash } = await buyTicket(wallet.seed, {
        eventId,
        seatId,
        team,
        paid: price + feeFor(price),
      }));
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
    const { offerId } = await offerTicket(held.wallet.seed, nftId, amount);
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
    await cancelOffer(wallet.seed, offer.offerId);
    clearOffer(nftId);
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
