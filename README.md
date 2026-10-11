# Fairseat

One seat at a final, sold once per team. The playoffs decide who sits in it.

Tickets for a final go on sale before anyone knows who is playing. You pay full price and hope.
Fairseat sells the same seat once for every team that could still get there. You buy "this seat, if
my team makes the final". Your ticket costs the seat's full price times your team's share of the
live odds. When the finalists are decided, the winning team's ticket becomes the seat and the rest
expire.

Built for the Blockchain at Berkeley hackathon. Runs on the XRPL **Testnet**.

## How a seat is priced

A $1,000 seat with four teams still alive on its side:

| Team | Odds | Ticket |
| ---- | ---- | ------ |
| A    | 50%  | $500   |
| B    | 30%  | $300   |
| C    | 15%  | $150   |
| D    | 5%   | $50    |

The four tickets always add up to $1,000, so the organizer is paid in full whoever wins. The fan
whose team makes it sits in a $1,000 seat for their team's share. Nobody is refunded for a team that
misses: that is why the ticket was cheap. Any ticket can be resold before then.

## What the XRP Ledger does

Six XRPL features work together. The code is in [`lib/fairseat/xrpl.ts`](lib/fairseat/xrpl.ts).

| Feature | What it does here |
| ------- | ----------------- |
| **NFTs** (XLS-20) | Each ticket is an NFT naming the event, the seat and the team. It sits in the fan's wallet. |
| **Issued token and trust lines** | Fans pay in a test dollar issued on the ledger. |
| **Token Escrow** (XLS-85) | A fan's payment is locked in an escrow for the organizer. It is released only when the finalists are decided. If it never is, the fan can take it back a month after the event. |
| **Batch** (XLS-56) | Buying is one all-or-nothing Batch: the fan's dollars go into escrow and the ticket moves to the fan, or neither happens. Settling a market is one Batch too. |
| **NFT offers** | A resale is one swap between two fans: the ticket and the money move in the same transaction. A gift is the same offer at a price of 0. |
| **NFT transfer fee** | The ledger pays the organizer 5% of every resale. No marketplace can skip it. |

### The life of a ticket

1. **Mint.** The organizer mints the ticket with an offer only the buyer can take (`NFTokenMint`
   with `Destination`).
2. **Buy.** The fan submits one `Batch` holding an `EscrowCreate` (the price, locked with a
   condition, for the organizer) and an `NFTokenAcceptOffer` (the ticket).
3. **Resell or send.** The holder makes an `NFTokenCreateOffer`. Another fan accepts it. The seller
   gets the price minus the organizer's 5%.
4. **Settle.** When the market settles, the organizer submits one `Batch` of `EscrowFinish` (release
   every payment for that side) and `NFTokenBurn` (remove the tickets for teams that missed out).
   Each escrow and ticket is then read back from the ledger, and only what really happened is
   recorded.

Example transactions on Testnet:

- Buy, as one Batch: [ADE3B4E3...](https://testnet.xrpl.org/transactions/ADE3B4E3D512B0B12EB56227E4270817ABBC09F13A6232CD797359722E587159)
- Settle, as one Batch: [4ECDF259...](https://testnet.xrpl.org/transactions/4ECDF25943B33B2C86288D34C00F92A9B5472E591DCA047DF01B0ED9231CB9F9)

### Why not RLUSD

We wanted to price tickets in RLUSD. On Testnet the RLUSD issuer has not switched on the setting
that lets its token be held in an escrow (`allowTrustLineLocking`), so an `EscrowCreate` in RLUSD is
refused. Fairseat issues its own test dollar with that setting on. Swapping to RLUSD is a change of
one currency and issuer once the setting is enabled.

## What the other sponsors do

- **Gemini prediction markets.** Each team's live odds of reaching the final set every ticket price,
  draw the charts, and decide which ticket becomes the seat when the market settles. Read from the
  public market data API. Code: [`lib/fairseat/gemini.ts`](lib/fairseat/gemini.ts).
- **Context.dev.** An organizer cannot put an event on sale until it passes three checks. Code:
  [`lib/fairseat/context.ts`](lib/fairseat/context.ts).
  1. The official page they link is read, and its name, date and venue must match what they typed.
  2. A separate search of the web, done without their page, must not contradict the date or venue.
     A made-up page can say anything, but it cannot change what the rest of the web says.
  3. The owner of the site the page is on is looked up and shown.

## Run it

Needs Node 22 or later.

```bash
npm install
cp .env.example .env.local
```

Make the two Testnet accounts. This writes their seeds to `.env.local`:

```bash
node --env-file-if-exists=.env.local scripts/setup-xrpl.mjs
```

Add a Context.dev key to `.env.local` as `CONTEXT_DEV_API_KEY` (only needed for listing an event).
Then:

```bash
npm run dev
```

Open http://localhost:3000.

## Try it

1. Press **Get a test wallet**. It is funded from the Testnet faucet and given 5,000 test dollars.
   This takes about half a minute.
2. Open an event, pick a section on the stadium map, then a seat.
3. Pick a team and pay. The receipt links to the Batch on the Testnet explorer.
4. On the ticket page, list it for sale at your own price, or send it to a friend with a claim link.
5. Open `/demo` to stand in for the day a market settles. Pick the team that makes the final: its
   tickets turn into seats with a gate code and the rest expire. **Settle on the ledger** then
   releases the escrows and burns the expired tickets.
6. Open **List an event** to see the Context.dev checks. Try a wrong date first.

## Pages

| Page | What it is |
| ---- | ---------- |
| `/` | Home, with a live preview of one event |
| `/events` | Events, with live odds |
| `/events/[id]` | Stadium map and seats |
| `/events/[id]/seats/[seat]` | One ticket per team, with live prices and resales |
| `/tickets` | The tickets in your wallet, read from the ledger |
| `/tickets/[id]` | One ticket: its worth over time, sell, send, and its trail on the ledger |
| `/claim/[offer]` | Claim a ticket a friend sent |
| `/events/[id]/market` | Every team's odds on one chart, today's movers, recent sales |
| `/wallet` | Balance, money locked in escrow, and every step with its transaction |
| `/organizer` | What each event has sold and where the money is on the ledger |
| `/organizer/new` | List an event, behind the Context.dev checks |
| `/demo` | Stage a result and settle it on the ledger |

## Limits

- Testnet only. The dollar is a test token and the wallets hold nothing of value.
- A fan's wallet seed is kept in an httpOnly cookie. That is fine for a testnet demo and not how a
  real wallet should be held.
- Sold tickets, open offers and listed events are indexed in a local `.data` folder. The tickets and
  the money themselves are on the ledger.
- One wallet can hold at most 4 tickets for the same team in an event, and a resale can ask at most
  150% of what the ticket costs new at that moment. Both are checked by the server, not by the
  ledger. The numbers are in [`lib/fairseat/rules.ts`](lib/fairseat/rules.ts).
- A fan who takes a payment back after the deadline gives up the ticket: the organizer burns it and
  the seat goes back on sale. A fan who has sold the ticket or given it away cannot take the payment
  back in the app. The cancel and the burn are two transactions, not one.
- Finals played at the teams' home arenas need a second condition (the home team must also make it).
  The events here are treated as neutral venues.

## Built with

Next.js 16, the Lime design system, Tailwind CSS, and xrpl.js. More on the idea and the decisions
behind it in [`docs/FAIRSEAT.md`](docs/FAIRSEAT.md).
