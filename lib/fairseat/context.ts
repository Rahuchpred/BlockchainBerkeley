// Checks an organizer's event against its official page, read through Context.dev.
//
// Context.dev opens the page and returns the event's name, date and venue as it finds them there.
// The comparison with what the organizer typed is done here, in plain code, so a pass or a fail can
// always be explained.
const API = "https://api.context.dev/v1/web/scrape";

export type EventClaim = { name: string; date: string; venue: string };

export type Check = {
  field: "name" | "date" | "venue";
  /** What the organizer entered. */
  claimed: string;
  /** What the official page says, or null if the page does not say. */
  found: string | null;
  ok: boolean;
};

export type PageCheck =
  { ok: boolean; checks: Check[]; page: string } | { error: string };

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
  return { ok: checks.every((check) => check.ok), checks, page: page.host };
}
