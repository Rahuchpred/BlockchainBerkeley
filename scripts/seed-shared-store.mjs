// Copies the local index in .data into the shared database, so a hosted copy of Fairseat starts
// with the tickets, releases and payments this machine already knows about. It only fills names
// that are still empty there, so it never writes over a live demo.
//
//   node --env-file=.env.local scripts/seed-shared-store.mjs
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error(
    "The shared database is not set up: KV_REST_API_URL and KV_REST_API_TOKEN are missing.",
  );
  process.exit(1);
}

const NAMES = [
  "sold.json",
  "released.json",
  "market.json",
  "events.json",
  "activity.json",
];

async function run(command) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  return body.result;
}

for (const name of NAMES) {
  const file = join(process.cwd(), ".data", name);
  if (!existsSync(file)) {
    console.log(`${name}: nothing local to copy`);
    continue;
  }
  // The same compact form the app writes.
  const text = JSON.stringify(JSON.parse(readFileSync(file, "utf8")));
  // NX: only if the name is not there yet.
  const done = await run(["SET", `fairseat:${name}`, text, "NX"]);
  console.log(
    `${name}: ${done === "OK" ? "copied" : "already there, left alone"}`,
  );
}
