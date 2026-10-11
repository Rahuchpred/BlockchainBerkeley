import { cookies } from "next/headers";
import { NBA_CONFERENCES, slug } from "./data";

// The team this browser organizes for on the organizer side. Each team has its own organizer wallet.
// Demo only: nothing checks that the visitor runs the team.
const COOKIE = "fairseat_team";

/** The teams that have an organizer wallet. */
export const TEAMS = Object.values(NBA_CONFERENCES).flatMap(
  (conference) => conference.teams,
);

export const teamName = (team: string) =>
  TEAMS.find((name) => slug(name) === team) ?? null;

/** The chosen team's slug, or the first team until one is chosen. */
export async function readTeam(): Promise<string> {
  const team = (await cookies()).get(COOKIE)?.value;
  return team && teamName(team) ? team : slug(TEAMS[0]);
}

export async function saveTeam(team: string) {
  (await cookies()).set(COOKIE, team, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
