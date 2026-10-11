import { cookies } from "next/headers";
import { BUYER_NAME, HOUSE_NAME, NBA_CODES, slug } from "./data";

// Who this browser is logged in as. Demo only: an account is opened by its username alone, with no
// password, so this shows who is who and protects nothing.
//
// - The buyer buys and holds tickets with the fan wallet.
// - A team's organizer releases that team's tickets from the team's own wallet.
// - The house organizer runs the events that the single organizer wallet sells.
//
// proxy.ts reads the same cookie to keep each account on its own pages. Keep the two in step.
const COOKIE = "fairseat_account";

export type Session =
  | { kind: "buyer"; name: string }
  | { kind: "team"; name: string; team: string }
  | { kind: "house"; name: string };

/** Where each kind of account lands after logging in. */
export const HOME = { buyer: "/", team: "/organizer/nba", house: "/organizer" };

const teamNamed = (team: string) =>
  Object.keys(NBA_CODES).find((name) => slug(name) === team);

function parse(value: string | undefined): Session | null {
  if (value === "buyer") return { kind: "buyer", name: BUYER_NAME };
  if (value === "house") return { kind: "house", name: HOUSE_NAME };
  const team = value?.startsWith("team:") ? value.slice(5) : "";
  const name = teamNamed(team);
  return name ? { kind: "team", name, team } : null;
}

export async function readSession(): Promise<Session | null> {
  return parse((await cookies()).get(COOKIE)?.value);
}

/** The account a username opens: the buyer's name, a team's code such as GSW, or the house's name. */
export function accountFor(username: string): string | null {
  const typed = username.trim().toLowerCase();
  if (typed === BUYER_NAME.toLowerCase()) return "buyer";
  if (typed === HOUSE_NAME.toLowerCase()) return "house";
  const team = Object.entries(NBA_CODES).find(
    ([, code]) => code.toLowerCase() === typed,
  );
  return team ? `team:${slug(team[0])}` : null;
}

export async function saveSession(account: string) {
  (await cookies()).set(COOKIE, account, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return parse(account);
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
