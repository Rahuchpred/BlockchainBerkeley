// Creates Fairseat's issuer account on the XRPL testnet and saves its seed to .env.local.
// The issuer mints the tickets and issues the test dollars fans pay with. Run once:
//
//   node scripts/setup-xrpl.mjs
//
// Testnet only. The account holds test XRP from the faucet and nothing of value.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { AccountSetAsfFlags, Client } from "xrpl";

const ENV = ".env.local";
if (existsSync(ENV) && /^XRPL_ISSUER_SEED=.+/m.test(readFileSync(ENV, "utf8"))) {
  console.log("XRPL_ISSUER_SEED is already set in .env.local. Nothing to do.");
  process.exit(0);
}

const client = new Client(process.env.XRPL_WS ?? "wss://testnet.xrpl-labs.com", { connectionTimeout: 20000 });
await client.connect();
const { wallet } = await client.fundWallet(null, { faucetHost: "faucet.altnet.rippletest.net" });

// Lets test dollars move between fans, which a resale needs.
await client.submitAndWait({ TransactionType: "AccountSet", Account: wallet.address, SetFlag: AccountSetAsfFlags.asfDefaultRipple }, { wallet });
await client.disconnect();

appendFileSync(ENV, `${existsSync(ENV) ? "\n" : ""}XRPL_ISSUER_SEED=${wallet.seed}\n`);
console.log(`Issuer ${wallet.address} funded. Seed saved to .env.local.`);
