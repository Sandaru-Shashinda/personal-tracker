import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// --- Retry transient network failures -------------------------------------------------------
// The Neon HTTP driver makes one HTTPS request per query, so a single dropped connection (flaky
// network, or Neon waking from auto-suspend) would otherwise crash the whole page.

const MAX_ATTEMPTS = 4;
/** Errors raised before the request reached the server, so even a write is safe to resend. */
const NOT_SENT = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT"]);
const RETRYABLE_STATUS = new Set([502, 503, 504]);

function errorCode(err: unknown): string | undefined {
  // undici wraps the socket error: TypeError("fetch failed", { cause: { code } })
  for (let e = err as { code?: string; cause?: unknown } | undefined, i = 0; e && i < 4; e = e.cause as typeof e, i++) {
    if (typeof e.code === "string") return e.code;
  }
}

/** Only plain SELECTs are retried after the request may have been sent (never writes). */
function isReadOnly(body: unknown): boolean {
  try {
    const parsed = JSON.parse(String(body)) as { query?: string; queries?: { query: string }[] };
    const queries = parsed.queries ?? [parsed];
    return queries.length > 0 && queries.every((q) => typeof q.query === "string" && /^\s*select\b/i.test(q.query));
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

neonConfig.fetchFunction = async (url: string, init: RequestInit) => {
  const readOnly = isReadOnly(init?.body);
  for (let attempt = 1; ; attempt++) {
    const last = attempt >= MAX_ATTEMPTS;
    try {
      const res = await fetch(url, init);
      if (readOnly && !last && RETRYABLE_STATUS.has(res.status)) {
        await sleep(150 * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      const code = errorCode(err);
      const retry = !last && (readOnly || (code !== undefined && NOT_SENT.has(code)));
      if (!retry) throw err;
      console.warn(`[db] network error (${code ?? "unknown"}), retrying (${attempt}/${MAX_ATTEMPTS - 1})`);
      await sleep(150 * 2 ** attempt);
    }
  }
};

// --- Client ------------------------------------------------------------------------------------

let _db: NeonHttpDatabase<typeof schema> | null = null;

function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

// Lazily initialised so `next build` works without a DATABASE_URL.
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export * from "./schema";
