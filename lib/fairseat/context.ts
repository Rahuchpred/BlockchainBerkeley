// Checks an organizer's event before it can go on sale, using three Context.dev lookups.
//
// 1. The official page. Context.dev opens the page the organizer linked and returns the event's
//    name, date and venue as it finds them there.
// 2. A second opinion. Context.dev researches the event on the open web, without being told about
//    the organizer's page. A fake page can say anything, but it cannot change what the rest of the
//    web says.
// 3. The site's owner. Context.dev says who runs the site the page is on.
//
// The comparison with what the organizer typed is done here, in plain code, so a pass or a fail can
// always be explained.
const BASE = "https://api.context.dev/v1";
const API = `${BASE}/web/scrape`;

export type EventClaim = { name: string; date: string; venue: string };

export type Check = {
  field: "name" | "date" | "venue";
  /** What the organizer entered. */
  claimed: string;
  /** What the official page says, or null if the page does not say. */
  found: string | null;
  ok: boolean;
};

/** What the rest of the web says. `ok` is null when the search could not tell either way. */
export type SecondOpinion = Omit<Check, "ok"> & { ok: boolean | null };

export type PageCheck =
  | {
      /** Every detail matches the page, and the web search contradicts none of them. */
      ok: boolean;
      checks: Check[];
      independent: SecondOpinion[];
      page: string;
      /** Who runs the site the page is on, if Context.dev knows. */
      owner: string | null;
    }
  | { error: string };

type Extracted = {
  event_name: string | null;
  date: string | null;
  venue: string | null;
};

const SCHEMA = {
  type: "object",
  properties: {
    event_name: {
      type: ["string", "null"],
      description: "The name of the event this page is about.",
    },
    date: {
      type: ["string", "null"],
      description: "The day the event is played, as YYYY-MM-DD.",
    },
    venue: {
      type: ["string", "null"],
      description: "The stadium or arena where the event is played.",
    },
  },
  required: ["event_name", "date", "venue"],
};

const FILLER = new Set(["the", "a", "an", "of", "at", "in", "and", "game"]);

const words = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !FILLER.has(word));

/** Every meaningful word of the shorter text appears in the longer one. */
function sameThing(a: string, b: string) {
  const [short, long] = [words(a), words(b)].sort(
    (x, y) => x.length - y.length,
  );
  return short.length > 0 && short.every((word) => long.includes(word));
}

async function post<T>(key: string, path: string, body: unknown) {
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Researches the event on the open web, without the organizer's page, and compares the date and venue. */
async function secondOpinion(
  key: string,
  claim: EventClaim,
): Promise<SecondOpinion[]> {
  const answer = await post<{
    json_content?: { date_yyyy_mm_dd?: string; venue?: string };
  }>(key, "/web/answers", {
    mode: "fast",
    task: `On what date and at which stadium or arena will the event "${claim.name}" be played? Use independent, reliable sources. Leave a field empty if you cannot find it.`,
    json_format: { date_yyyy_mm_dd: "", venue: "" },
    timeoutOpts: { milliseconds: 30000, behavior: "return-partial" },
  });
  // The date can come back with other separators, such as 2027_02_14.
  const date =
    answer?.json_content?.date_yyyy_mm_dd?.slice(0, 10).replace(/\D/g, "-") ||
    null;
  const venue = answer?.json_content?.venue || null;
  return [
    {
      field: "date",
      claimed: claim.date,
      found: date,
      ok: date ? date === claim.date : null,
    },
    {
      field: "venue",
      claimed: claim.venue,
      found: venue,
      ok: venue ? sameThing(claim.venue, venue) : null,
    },
  ];
}

/** The site a page belongs to, without subdomains: en.wikipedia.org is wikipedia.org. */
function siteOf(host: string) {
  const parts = host.split(".");
  const twoPart =
    parts.length > 2 &&
    parts[parts.length - 1].length === 2 &&
    parts[parts.length - 2].length <= 3;
  return parts.slice(twoPart ? -3 : -2).join(".");
}

async function siteOwner(key: string, host: string) {
  const brand = await post<{ brand?: { title?: string } }>(
    key,
    "/brand/retrieve",
    {
      type: "by_domain",
      domain: siteOf(host),
      timeoutOpts: { milliseconds: 30000, behavior: "return-partial" },
    },
  );
  return brand?.brand?.title || null;
}

export async function checkEventPage(
  url: string,
  claim: EventClaim,
): Promise<PageCheck> {
  const key = process.env.CONTEXT_DEV_API_KEY;
  if (!key)
    return { error: "The page check is not connected: no Context.dev key" };

  let page: URL;
  try {
    page = new URL(url);
    if (page.protocol !== "https:" && page.protocol !== "http:")
      throw new Error("not a web address");
  } catch {
    return { error: "Enter the full web address of the official event page" };
  }

  let body: {
    json?: { success?: boolean; data?: Extracted | null; message?: string };
    message?: string;
  };
  try {
    const response = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: page.href,
        formats: { json: true },
        jsonParams: {
          schema: SCHEMA,
          instructions:
            "Use only facts stated on the page. If the page covers several events or dates, use the main one. Give the date as YYYY-MM-DD.",
        },
        timeoutOpts: { milliseconds: 60000 },
      }),
      signal: AbortSignal.timeout(75000),
    });
    body = await response.json();
    if (!response.ok)
      return {
        error: `Context.dev could not read the page: ${body.message ?? response.status}`,
      };
  } catch {
    return { error: "Context.dev did not answer in time. Try again." };
  }

  const found = body.json?.data;
  if (!body.json?.success || !found)
    return {
      error: `Context.dev could not read the page: ${body.json?.message ?? "no details found"}`,
    };

  const checks: Check[] = [
    {
      field: "name",
      claimed: claim.name,
      found: found.event_name,
      ok: found.event_name ? sameThing(claim.name, found.event_name) : false,
    },
    {
      field: "date",
      claimed: claim.date,
      found: found.date,
      ok: found.date?.slice(0, 10) === claim.date,
    },
    {
      field: "venue",
      claimed: claim.venue,
      found: found.venue,
      ok: found.venue ? sameThing(claim.venue, found.venue) : false,
    },
  ];
  // One lookup at a time: the plan allows a single request in flight.
  const independent = await secondOpinion(key, claim);
  const owner = await siteOwner(key, page.hostname);
  return {
    ok:
      checks.every((check) => check.ok) &&
      independent.every((check) => check.ok !== false),
    checks,
    independent,
    page: page.host,
    owner,
  };
}
