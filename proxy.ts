import { NextResponse, type NextRequest } from "next/server";

// Keeps each account on its own pages, before a page is rendered. The cookie is the one written by
// lib/fairseat/session.ts: "buyer", "house" or "team:" and the team. Keep the two in step.
//
// - Nobody logged in: everything leads to the login page.
// - The buyer: every page except the organizer side.
// - A club's organizer: the club desk only.
// - The house organizer: the organizer side except the club desk.
// The landing page, the proof pages, the gate check and the demo controls stand outside the
// accounts and are open to everyone, logged in or not.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const account = request.cookies.get("fairseat_account")?.value;
  const go = (path: string) =>
    pathname === path
      ? NextResponse.next()
      : NextResponse.redirect(new URL(path, request.url));

  const open =
    ["/", "/login", "/demo", "/gate"].includes(pathname) ||
    pathname.startsWith("/proof/");
  if (open) return NextResponse.next();
  const desk = pathname.startsWith("/organizer/nba");
  if (account === "buyer")
    return pathname.startsWith("/organizer")
      ? go("/events")
      : NextResponse.next();
  if (account === "house")
    return pathname.startsWith("/organizer") && !desk
      ? NextResponse.next()
      : go("/organizer");
  if (account?.startsWith("team:"))
    return desk ? NextResponse.next() : go("/organizer/nba");
  return go("/login");
}

export const config = {
  // Pages only: not the app's own files, its images or the market data the pages fetch.
  matcher: ["/((?!api|_next|.*\\.[a-z0-9]+$).*)"],
};
