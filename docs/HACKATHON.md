# Hackathon requirements

Sources: the official hackathon info page (pasted 2026-10-11) and the opening
slides (photos taken 2026-10-11). Where the two disagree, the page is used and
the difference is noted.

## Hackathon information

- **Tracks:** you can apply to multiple tracks, but must choose one General
  Track (Most Creative or Most Technically Impressive).
- The top 2 teams for Most Creative and Most Technically Impressive will be
  called up for live demos (4 teams total).
- A winning project is one that brings technical novelty and creativity to
  solve an interesting problem.
- Projects will be scored based on Technical Impressiveness, Creativity, and
  Functionality. Social proof (traction with users or social media) is also
  considered.
- Judging rubrics will not be shared.

We advise against:

- Simple frontends with lackluster backends
- Projects with hard-coded functionality (judges will check)
- Submitting a pre-existing startup/project (see project requirements below)

We encourage you to:

- Use AI coding tools heavily to build fast
- Be as creative as possible!

## Project requirements

- Projects must be built during the hackathon. Pre-existing startups or
  projects will not be allowed. Building on top of an existing product is
  allowed, but only the new feature will be evaluated - it must stand on its
  own merit.
- Functionality should be real - that means you should not hard-code the core
  functionality of your product.
- Your team will submit:
  - A recorded demo as a YouTube link (2 minutes MAX)
  - A GitHub repo (must be public)
  - (recommended) A live deployment link

## Submit

[www.hackathoncompany.com/platform](https://www.hackathoncompany.com/platform)
(allow 15 mins for submission)

## Cursor credits

Cursor will be providing credits (Pro API) to all hackers. Attend the Cursor
Workshop to redeem your credits.

## Prize summary

| Track | First | Runner-up |
|---|---|---|
| Most Technically Impressive | $1,250 | $500 |
| Most Creative | $1,250 | $500 |
| Best Use of AUSD | $1,000 | $500 |
| Best Use of Gemini Prediction API | $1,000 | $500 |
| Best Use of Ripple | $1,000 | $500 |
| YZi Labs: Programmable Capital, Intelligence & Science | $1,000 + EASY Residency interview | $500 + EASY Residency interview |
| BONUS: Best Use of ElevenLabs | $250 + 3 months Scale Plan per member | none |
| BONUS: Best Use of Context.dev | $750 + $5k credits | none |

The slides showed each general track as a single $1750 figure, which is the
first place and runner-up amounts added together.

## General Tracks ($3,500)

- Most Technically Impressive: $1,250
- Technical Runner-Up: $500
- Most Creative: $1,250
- Creative Runner-Up: $500

[Guest Judges](https://app.notion.com/p/e3943bcc211c82c3a1bf81e6876a0d18?pvs=21)

## Best Use of AUSD ($1,500)

Agora issues AUSD, a fully reserved, institutional-grade digital dollar live on
10+ chains. As AI agents start buying, selling, and paying for things on their
own, they need a dollar that moves as easily as an API call. That's AUSD.

This track goes to the best project built around AUSD, with a focus on agentic
payments and x402. x402 is the open protocol that revives HTTP's
`402 Payment Required` so any API, website, or agent can charge and pay per
request in stablecoins. AUSD supports ERC-3009 gasless transfers, the primitive
x402 payments are built on, so your agents can pay without holding gas.

The best projects will showcase AUSD use cases or flows in a creative and
practical way that can be used in the real world.

Setup:

1. Grab a wallet and testnet gas. We recommend Base Sepolia.
2. Mint free testnet AUSD from the
   [faucet](https://docs.agora.finance/instant-settlement/guides/getting-testnet-tokens)
   (10,000 AUSD per request).
3. Connect the Agora Docs MCP to your coding agent:
   `claude mcp add --transport http agora https://docs.agora.finance/_mcp/server`
   (or add it in Cursor).
4. Build!
5. Questions? Find the Agora team table.

Prizes: First Place $1,000, Runner-Up $500.

Resources: [Agora Docs](https://docs.agora.finance/),
[AUSD Deployments](https://docs.agora.finance/developer/contract-deployments),
[Agora Docs MCP](https://docs.agora.finance/_mcp/server),
[Faucet Guide](https://docs.agora.finance/instant-settlement/guides/getting-testnet-tokens)

[Track Judge](https://app.notion.com/p/9fe43bcc211c83069da18163c67af9fd?pvs=21)

## Best Use of Gemini Prediction API ($1,500)

Gemini is a regulated crypto exchange and prediction market. Its Prediction
Markets API lets you discover events, stream live odds, and trade event
contracts on crypto, sports, politics, weather, and more.

This track goes to the best project built on the Gemini Predictions API. Market
data is public, and trading runs in Gemini's sandbox with test funds, so your
bots and agents can place real orders risk-free.

The best projects will showcase prediction markets in a creative and practical
way that can be used in the real world.

Setup:

1. Create a free demo account at the sandbox (comes with $100k test USD) and
   generate an API key.
2. Install the SDK (`npm install @gemini-markets/sdk`) or connect the Gemini MCP
   server to your coding agent.
3. Build!
4. Questions? Find the Gemini team table.

Prizes: First Place $1,000, Runner-Up $500.

Resources: [Prediction Markets Docs](https://developer.gemini.com/prediction-markets/getting-started),
[API Reference](https://developer.gemini.com/prediction-markets-spec),
[Demo Environment](https://exchange.sandbox.gemini.com/),
[TypeScript SDK](https://developer.gemini.com/tools/typescript-sdk/quickstart),
[MCP Server](https://github.com/gemini/developer-platform)

[Track Judges](https://app.notion.com/p/3f243bcc211c808fbd47c30e968beac8?pvs=21)

## Best Use of Ripple ($1,500)

The XRP Ledger (XRPL) is a fast, low-cost blockchain built for payments, with
powerful features built directly into the protocol: native DEX, escrow,
stablecoins like RLUSD, multi-purpose tokens, credentials, and new lending
primitives (Single Asset Vaults and the Lending Protocol).

This track goes to the best project that uses XRPL to solve a real-world
problem. Projects that combine multiple XRPL features into one cohesive product
will stand out.

The best projects will showcase XRPL in a creative and practical way that can
be used in the real world.

Setup:

1. Get a free funded wallet from the XRPL Testnet or Devnet faucet.
2. Install the SDK (`npm install xrpl` or `pip install xrpl-py`) and connect the
   XRPL MCP server (`https://xrpl.org/mcp`) to your coding agent.
3. Build!
4. Questions? Find the Ripple team table.

Prizes: First Place $1,000, Runner-Up $500.

Resources: [XRPL Docs](https://xrpl.org/docs),
[Testnet Faucet](https://xrpl.org/resources/dev-tools/xrp-faucets),
[xrpl.js](https://js.xrpl.org/),
[xrpl-py](https://xrpl-py.readthedocs.io/),
[AI Tools & MCP Server](https://xrpl.org/resources/dev-tools/ai-tools)

[Track Judge](https://app.notion.com/p/3f243bcc211c809a9cf0c148255a8c17?pvs=21)

## YZi Labs Track: Build for Programmable Capital, Intelligence & Science ($1,500 + EASY Residency interview fast-track)

YZi Labs backs early-stage founders across Web3, AI and biotech. This track is
open to any chain and any stack. Build something at the intersection of
capital, intelligence or science: new financial rails, agents that can transact
and be trusted, compute markets, AI interfaces, or tools for AI-native science.
We're judging on whether the idea solves a real bottleneck and whether the team
could keep building it after today.

Idea starters:

- Stablecoin payments: merchant checkout, payroll, remittance, usage-based
  billing for software
- Agent wallets: give an AI agent delegated spending, permissions and an audit
  trail
- Onchain markets: tokenized assets as collateral, hedging or structured yield
  for RWAs
- Trusted agent infra: identity, authorization, tamper-evident logs for agents
  acting on tools or money
- Compute markets: routing, benchmarking or pricing inference across GPU
  providers
- Privacy-first memory: a personal context layer an assistant can use without
  leaking data
- Voice-first agents: spoken intent into actions in a specific workflow
- AI x Bio: lab data middleware, clinical trial tooling, consent and provenance
  for biological data

Setup:

1. Grab a wallet and free testnet BNB from the faucet. Deploy on BSC Testnet or
   opBNB Testnet.
2. Connect the BNB Chain MCP server to your coding agent:
   `claude mcp add bnbchain -- npx -y @bnb-chain/mcp@latest` (or add it in
   Cursor).
3. Build!
4. Questions? Find the YZi Labs team table.

Prizes:

- First Place: $1,000 + a first-round interview for
  [EASY Residency Season 5](https://www.yzilabs.com/easy-residency) (10-week
  program, up to USD 500K investment)
- Runner-Up: $500 + a first-round interview for
  [EASY Residency Season 5](https://www.yzilabs.com/easy-residency)

Resources: [BNB Chain Docs](https://docs.bnbchain.org/),
[Testnet Faucet](https://www.bnbchain.org/en/testnet-faucet),
[BNB Chain MCP](https://github.com/bnb-chain/bnbchain-mcp)

[Track Judge](https://app.notion.com/p/3f243bcc211c8008b2efe3f046555204?pvs=21)

## BONUS: Best Use of ElevenLabs ($250 + $3k credits)

ElevenLabs is the leading AI audio platform, with lifelike text-to-speech,
speech-to-text, voice cloning, sound effects, music, and real-time
conversational voice agents, all available through one API. This bonus goes to
the team that makes the best use of ElevenLabs.

Claim free ElevenLabs access through the automated Discord system:

1. Join the Discord server: https://discord.com/invite/VnBvbbcdEC
2. Gain access to the #coupon-codes channel
3. Click "Start Redemption"
4. Select the event and fill out the form using the email used for registration
5. The bot sends the unique coupon code

Prize: First Place $250 + each team member of the winning team earns 3 months
of the Scale Plan ($1k value).

Resources: [Video Tutorial](https://youtu.be/S143_JtCtV8)

[Track Judge](https://app.notion.com/p/3f443bcc211c80188444f6b0b87bf383?pvs=21)

## BONUS: Best Use of Context.dev ($750 + $5k credits)

Context.dev gives your agents live context from the web through a single API:
answers, web search, scraping, website monitoring, and people and company data.
This bonus goes to the team that makes the best use of any Context.dev API.

Setup:

1. Sign up at [context.dev](https://www.context.dev/) and grab your API key.
2. Install the agent skill:
   `npx skills add https://docs.context.dev --skill context-dev --yes`
3. Build!

Prize: First Place $750 + $5k credits.

Resources: [API Docs](https://docs.context.dev/introduction),
[Agent Skill](https://docs.context.dev/install-skill),
[API Reference](https://docs.context.dev/api-reference/web-scraping/scrape),
[Highlights](https://www.context.dev/blog/introducing-context-highlights)

[Track Judge](https://app.notion.com/p/3f243bcc211c80d98cdbffddbf6bd926?pvs=21)
