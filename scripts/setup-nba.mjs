// Opens the 30 NBA teams' organizer accounts on the XRPL testnet ahead of time.
//
// Optional: the app opens a team's account the first time that team releases tickets, which adds
// about 20 seconds to that release. Run this once to have all 30 ready.
//
// A team's keys are worked out from XRPL_ORGANIZER_SEED and the team, exactly as teamOrganizer does
// in lib/fairseat/xrpl.ts. Keep the two in step.
//
// The faucet turns away requests that come too fast, so it is asked once, for a funding account that
// then opens each team's account with a few XRP of its own.
//
// Safe to run again: each step is skipped if it is already done.
//
//   node --env-file-if-exists=.env.local scripts/setup-nba.mjs
//
// Testnet only. The accounts hold test XRP from the faucet and nothing of value.
import { createHash } from "node:crypto";
import { Client, Wallet } from "xrpl";

const FAUCET = "faucet.altnet.rippletest.net";
/** Enough XRP for the account's reserve, its trust line, its tickets and its fees. */
const OPENING_DROPS = "3000000";
const MARKET = "https://api.gemini.com/v1/prediction-markets/events/NBAF-2627CHAMP";
const { XRPL_ISSUER_SEED, XRPL_ORGANIZER_SEED } = process.env;
if (!XRPL_ISSUER_SEED || !XRPL_ORGANIZER_SEED)
  throw new Error("Run scripts/setup-xrpl.mjs first: the issuer and organizer seeds are not set.");

const slug = (team) =>
  team
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const teamOrganizer = (team) =>
  Wallet.fromEntropy(
    createHash("sha512").update(`${XRPL_ORGANIZER_SEED}|team|${team}`).digest().subarray(0, 16),
  );

const market = await (await fetch(MARKET)).json();
const teams = market.contracts.map((contract) => contract.label).sort();

const issuer = Wallet.fromSeed(XRPL_ISSUER_SEED).address;
const client = new Client(process.env.XRPL_WS ?? "wss://testnet.xrpl-labs.com", { connectionTimeout: 20000 });
await client.connect();

const missing = (error) => error?.data?.error === "actNotFound";
const ok = (done, what) => {
  const result = done.result.meta.TransactionResult;
  if (result !== "tesSUCCESS") throw new Error(`${what}: ${result}`);
};

let funder;

async function setUp(name) {
  const wallet = teamOrganizer(slug(name));
  const exists = await client.request({ command: "account_info", account: wallet.address }).then(
    () => true,
    (error) => {
      if (missing(error)) return false;
      throw error;
    },
  );
  if (!exists) {
    funder ??= (await client.fundWallet(null, { faucetHost: FAUCET })).wallet;
    ok(
      await client.submitAndWait(
        { TransactionType: "Payment", Account: funder.address, Destination: wallet.address, Amount: OPENING_DROPS },
        { wallet: funder },
      ),
      "Opening the account",
    );
  }
  const lines = (await client.request({ command: "account_lines", account: wallet.address, peer: issuer })).result.lines;
  if (!lines.some((line) => line.currency === "USD")) {
    ok(
      await client.submitAndWait(
        { TransactionType: "TrustSet", Account: wallet.address, LimitAmount: { currency: "USD", issuer, value: "100000000" } },
        { wallet },
      ),
      "Trusting test dollars",
    );
  }
  return `${wallet.address}${exists ? "" : ", opened"}`;
}

let failed = 0;
for (const name of teams) {
  // A step the network dropped is tried again after a pause.
  for (let attempt = 1; ; attempt += 1) {
    try {
      console.log(`${name}: ${await setUp(name)}`);
      break;
    } catch (error) {
      if (attempt === 3) {
        failed += 1;
        console.log(`${name}: failed, ${error.message}`);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }
  }
}

await client.disconnect();
console.log(failed ? `${failed} of ${teams.length} teams are not ready. Run this again.` : `All ${teams.length} team accounts are ready.`);
