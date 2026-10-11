// Sets up Fairseat's two accounts on the XRPL testnet and saves their seeds to .env.local.
//
// - The issuer issues the test dollars fans pay with.
// - The organizer mints the tickets and is who the fans' money is released to.
//
// Safe to run again: each step is skipped if it is already done.
//
//   node --env-file-if-exists=.env.local scripts/setup-xrpl.mjs
//
// Testnet only. The accounts hold test XRP from the faucet and nothing of value.
import { appendFileSync } from "node:fs";
import { AccountSetAsfFlags, Client, Wallet } from "xrpl";

const ENV = ".env.local";
const FAUCET = "faucet.altnet.rippletest.net";
const client = new Client(process.env.XRPL_WS ?? "wss://testnet.xrpl-labs.com", { connectionTimeout: 20000 });
await client.connect();

async function account(name) {
  if (process.env[name]) return Wallet.fromSeed(process.env[name]);
  const { wallet } = await client.fundWallet(null, { faucetHost: FAUCET });
  appendFileSync(ENV, `\n${name}=${wallet.seed}\n`);
  console.log(`${name}: made ${wallet.address}, seed saved to ${ENV}`);
  return wallet;
}

async function submit(tx, wallet, what) {
  const done = await client.submitAndWait(tx, { wallet });
  const result = done.result.meta.TransactionResult;
  if (result !== "tesSUCCESS") throw new Error(`${what}: ${result}`);
  console.log(`${what}: done`);
}

const issuer = await account("XRPL_ISSUER_SEED");
const organizer = await account("XRPL_ORGANIZER_SEED");

const flags = (await client.request({ command: "account_info", account: issuer.address })).result.account_flags;
// Lets test dollars move between fans, which a resale needs.
if (!flags.defaultRipple)
  await submit({ TransactionType: "AccountSet", Account: issuer.address, SetFlag: AccountSetAsfFlags.asfDefaultRipple }, issuer, "Letting test dollars move between fans");
// Lets test dollars be locked in an escrow, which is how a fan's payment is held until the final is decided.
if (!flags.allowTrustLineLocking)
  await submit({ TransactionType: "AccountSet", Account: issuer.address, SetFlag: AccountSetAsfFlags.asfAllowTrustLineLocking }, issuer, "Letting test dollars be held in escrow");

const lines = (await client.request({ command: "account_lines", account: organizer.address, peer: issuer.address })).result.lines;
if (!lines.some((line) => line.currency === "USD"))
  await submit({ TransactionType: "TrustSet", Account: organizer.address, LimitAmount: { currency: "USD", issuer: issuer.address, value: "100000000" } }, organizer, "Letting the organizer hold test dollars");

await client.disconnect();
console.log(`Issuer ${issuer.address}, organizer ${organizer.address}. Ready.`);
