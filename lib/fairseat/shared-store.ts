import {
  MessageChannel,
  Worker,
  receiveMessageOnPort,
} from "node:worker_threads";

// Fairseat's state beside the ledger, kept in one Redis database so every running copy of the app
// reads the same thing. On Vercel each page runs on its own, so files would be seen by one page and
// not the next. The rest of the app reads this state without waiting, so the request to Redis is
// made on a second thread while this one sleeps until the answer is in.
const URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

/** Whether the shared database is set up. Without it the state is kept in files. */
export const shared = Boolean(URL && TOKEN);

const PREFIX = "fairseat:";
/** How long an answer is reused, so one page asks once however many lookups it makes. */
const FRESH_MS = 300;
const TIMEOUT_MS = 8000;

const THREAD = `
const { parentPort, workerData } = require("node:worker_threads");
parentPort.on("message", async ({ signal, port, command }) => {
  let reply;
  try {
    const response = await fetch(workerData.url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + workerData.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    const body = await response.json();
    reply = response.ok ? { result: body.result } : { error: body.error };
  } catch (error) {
    reply = { error: String(error) };
  }
  port.postMessage(reply);
  const flag = new Int32Array(signal);
  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
});
`;

// One thread for the life of the server. It is kept on globalThis so a reload in development does
// not start another.
const held = globalThis as { fairseatStore?: Worker };

function thread() {
  if (!held.fairseatStore) {
    const worker = new Worker(THREAD, {
      eval: true,
      workerData: { url: URL, token: TOKEN },
    });
    // The thread must not keep the server alive on its own.
    worker.unref();
    worker.on("exit", () => {
      held.fairseatStore = undefined;
    });
    held.fairseatStore = worker;
  }
  return held.fairseatStore;
}

/** Runs one Redis command and waits for its answer. */
function run(command: string[]): unknown {
  const signal = new SharedArrayBuffer(4);
  const { port1, port2 } = new MessageChannel();
  thread().postMessage({ signal, port: port2, command }, [port2]);
  Atomics.wait(new Int32Array(signal), 0, 0, TIMEOUT_MS);
  const reply = receiveMessageOnPort(port1)?.message as
    { result?: unknown; error?: string } | undefined;
  port1.close();
  if (!reply || reply.error !== undefined)
    throw new Error(
      `The shared store could not be reached${reply?.error ? `: ${reply.error}` : ""}`,
    );
  return reply.result;
}

const known = new Map<string, { at: number; text: string | null }>();

// How long this server has been running, in milliseconds. Only used to age the answers above. It is
// not the time of day, which a page must not read while it is being prepared ahead of a request.
const now = () => Number(process.hrtime.bigint() / BigInt(1_000_000));

/** The saved text under each name, or null where nothing is saved. Asked for together, in one request. */
export function readShared(names: string[], wanted: string): string | null {
  const have = known.get(wanted);
  if (have && now() - have.at < FRESH_MS) return have.text;
  const found = run(["MGET", ...names.map((name) => PREFIX + name)]) as (
    string | null
  )[];
  const at = now();
  names.forEach((name, index) =>
    known.set(name, { at, text: found[index] ?? null }),
  );
  return known.get(wanted)?.text ?? null;
}

export function writeShared(name: string, text: string) {
  run(["SET", PREFIX + name, text]);
  known.set(name, { at: now(), text });
}
