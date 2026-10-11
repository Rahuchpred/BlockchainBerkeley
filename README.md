# Fairseat

One seat at a final, sold once per team. The playoffs decide who sits in it.

**Live:** https://fairseat-lac.vercel.app

Built at the Blockchain at Berkeley hackathon. Runs on the XRP Ledger Testnet.

## The idea

Tickets for a final go on sale before anyone knows who is playing. Fans pay full price and hope.

Fairseat sells the same seat once for every team that could still get there. You buy "this seat, if
my team makes the final". The ticket costs the seat's full price times your team's live chance of
getting there. When the finalists are decided, the winning team's ticket becomes the seat and the
others expire.

A $1,000 seat with four teams still alive:

| Team | Live chance | Ticket |
| ---- | ----------- | ------ |
| A    | 50%         | $500   |
| B    | 30%         | $300   |
| C    | 15%         | $150   |
| D    | 5%          | $50    |

The four tickets add up to $1,000, so the club is paid in full whoever wins. The fan whose team
makes it sits in a $1,000 seat for their team's share.

## Try it in two minutes

Open https://fairseat-lac.vercel.app and log in. There are no passwords.

| Log in as | You are | You can |
| --------- | ------- | ------- |
| `Mike` | A fan | Browse events, buy, resell, send a ticket to a friend |
| `GSW`, `BOS`, `LAL` or any NBA team code | A club | Release your own tickets and see what they earned |
| `Fairseat` | The organizer of the other events | See the dashboard, list an event, settle a result |

The full loop, with two browser windows:

1. Log in as `BOS`. Pick a section on the arena map, pick seats, press **Release**. The tickets are
   minted on the ledger from Boston's own wallet.
2. In the other window log in as `Mike`. Open **NBA Finals, Game 1**, pick that seat, pick Boston,
   and pay. A wallet with 5,000 test dollars is made for you on the first purchase.
3. Open the ticket. Press **Proof** to see the transaction, with a link to the public ledger
   explorer.
4. Open `/gate` and paste the ticket's code. The gate reads the ledger and answers.

## How we used each sponsor

### Ripple: the XRP Ledger

Everything that matters happens on the ledger. Code: [`lib/fairseat/xrpl.ts`](lib/fairseat/xrpl.ts).

| XRPL feature | What it does in Fairseat |
| ------------ | ------------------------ |
| **NFTs** (XLS-20) | Every ticket is an NFT that names the event, the seat and the team. It sits in the fan's own wallet. |
| **Token Escrow** (XLS-85) | The fan's payment is locked in an escrow under a crypto-condition. It is released to the club only when the finalists are decided. If it is never released, the fan can take it back after the deadline. |
| **Batch** (XLS-56) | Buying is one all-or-nothing Batch: the money goes into escrow and the ticket moves to the fan, or neither happens. Up to four neighbouring seats are bought in one Batch. Clubs mint eight tickets per Batch. Settling is a Batch too. |
| **NFT offers** | A resale is one swap between two fans: ticket and money move in the same transaction. Sending a ticket to a friend is the same offer at a price of 0. |
| **NFT transfer fee** | The ledger itself pays the club 5% of every resale. No marketplace can skip it. |
| **Issued token and trust lines** | Fans pay in a dollar token issued on the ledger. |
| **Credentials** | An organizer whose event passes the page check gets a verified-organizer credential on the ledger. |

**Each club has its own wallet.** The 30 NBA clubs are the organizers. Each one has its own ledger
account with its own keys. It mints its own tickets, and its fans' escrows are made out to it.

**The life of a ticket**

1. **Release.** The club mints the ticket into its own account (`NFTokenMint`, up to eight in one
   `Batch`).
2. **Buy.** The club offers the ticket to the buyer alone (`NFTokenCreateOffer` with `Destination`).
   The fan submits one `Batch`: an `EscrowCreate` for the price and an `NFTokenAcceptOffer` for the
   ticket.
3. **Resell or send.** The holder makes an `NFTokenCreateOffer` and another fan accepts it. The
   seller gets the price less the club's 5%.
4. **Settle.** When the result is known, the club submits a `Batch` of `EscrowFinish` (release the
   payments) and `NFTokenBurn` (remove the tickets of teams that missed out). Every escrow and
   ticket is then read back from the ledger, and only what really happened is recorded.
5. **Gate.** The gate reads the ledger to see who holds the ticket and whether it is the winning
   one.

**Real transactions from our testing, on the public Testnet explorer**

- A fan buys a Golden State ticket, as one Batch: [783A63B2...](https://testnet.xrpl.org/transactions/783A63B255CCD799EEA19915DD96E8C8448091E9D492EECF667734C3DF269C77)
- A second fan buys that ticket on resale: [CDF12BE3...](https://testnet.xrpl.org/transactions/CDF12BE314407112995FFEE61EC0EB2B2FD84F655AE3E14E6EBE1F28CFD385E3)
- A settlement, as one Batch: [4ECDF259...](https://testnet.xrpl.org/transactions/4ECDF25943B33B2C86288D34C00F92A9B5472E591DCA047DF01B0ED9231CB9F9)

Every step in the app has its own proof page that shows the transaction as the ledger recorded it.

### Gemini Prediction Markets API

The odds are the product. Code: [`lib/fairseat/gemini.ts`](lib/fairseat/gemini.ts).

- **Every price comes from a live market.** A ticket costs the seat's full price times the team's
  share of the live odds on Gemini.
- **Prices are worked out on the server when you pay.** The browser never sets a price.
- **Prices move on screen.** The seat page asks for fresh odds every 15 seconds. When a number
  changes it rolls to the new figure and is tinted green or red.
- **Price history draws the charts.** Each team's chance over the last week and month, and all
  teams on one chart on the market page.
- **The market decides the winner.** When a Gemini market settles, that team's tickets become seats.
- **Six markets price real events:** the AFC and NFC champions, the American and National League
  champions, the Champions League winner, and the NBA champion, which we split into an Eastern and
  a Western side so each half of the arena has its own odds.
- **More markets are shown live** on the events page, each with the reason it does not sell seats
  yet.

### Context.dev

It keeps fake events off the site. Code: [`lib/fairseat/context.ts`](lib/fairseat/context.ts).

An organizer cannot put an event on sale until it passes three checks:

1. The official page they link is read. Its name, date and venue must match what they typed.
2. A separate search of the web, done without their page, must agree on the date and venue. A
   made-up page can say anything, but it cannot change what the rest of the web says.
3. The owner of the site the page is on is looked up and shown.

Try it: log in as `Fairseat`, open **List an event**, and enter a wrong date.

## Why this is real and not a mock-up

- **Nothing is hard-coded.** Odds, prices, balances, tickets and payments are read live.
- **Every action is a real transaction.** Releasing, buying, reselling, sending, refunding and
  settling each write to the XRP Ledger, and each has a public proof link.
- **The ledger is the source of truth.** A fan's tickets are read from their wallet on the ledger.
  The gate reads the ledger. After every Batch the result is read back before anything is recorded.
- **It is fair by rule.** One wallet can hold at most 4 tickets for a team in an event, and a resale
  can ask at most 150% of today's price. See [`lib/fairseat/rules.ts`](lib/fairseat/rules.ts).
- **It is tested with several accounts at once.** In one run, two clubs released tickets from two
  wallets, a fan bought one, resold it to a second fan in another browser, and the gate found it
  with its new holder. The hosted site showed all of it.

## Pages

| Page | What it is |
| ---- | ---------- |
| `/` | Home |
| `/login` | Log in as a fan, a club or the organizer |
| `/events` | Events with live odds |
| `/events/[id]` | The stadium map and its seats |
| `/events/[id]/seats/[seat]` | One ticket per team, with live prices and resales |
| `/events/[id]/market` | Every team's odds on one chart |
| `/tickets` and `/tickets/[id]` | Your tickets, read from the ledger: worth over time, sell, send |
| `/wallet` | Balance, money locked in escrow, every step with its transaction |
| `/organizer/nba` | The club desk: release tickets on the arena map, see sales and the club's wallet |
| `/organizer` | The organizer's dashboard: sales and where the money is on the ledger |
| `/organizer/new` | List an event, behind the Context.dev checks |
| `/gate` | Check a ticket at the gate |
| `/proof/[hash]` | One transaction, as the ledger recorded it |
| `/demo` | Stage a result and settle it on the ledger |

## Run it yourself

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

Open http://localhost:3000 and log in as `Mike`, a team code, or `Fairseat`.

## Built with

Next.js 16, xrpl.js, Tailwind CSS, the Lime design system, Inter, Motion with a component from
interior.dev for the live numbers, and Upstash Redis for the shared ticket index. Hosted on Vercel.

More on the idea and the decisions behind it in [`docs/FAIRSEAT.md`](docs/FAIRSEAT.md).
