import { NextResponse } from "next/server";
import { allow, allowPublic, clientIp } from "@/lib/guard";
import { createCache } from "@/lib/server/cache";
import { getStore } from "@/lib/server/store";
import { tokenLocks } from "@/lib/server/locks";
import { parseTokenQuery, type TokenLocksAnswer } from "@/lib/locks-by-token";

export const dynamic = "force-dynamic";
/** A cold answer walks about ten 10M-block windows of HoodLock logs plus a few Multicall3 reads. */
export const maxDuration = 60;

/*
 * Active HoodLock locks of one token: GET /api/locks?token=0x…
 * Open to other sites (CORS, GET only). Answers are cached 5 minutes (30 seconds when the walk stopped early) in
 * memory and the shared store; a cold answer is limited per network and site-wide. Response shape: TokenLocksAnswer
 * in src/lib/locks-by-token.ts.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

const TTL = 300;
const cache = createCache<TokenLocksAnswer>("locks", getStore, 1_000);

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...CORS, "cache-control": "no-store", ...extra } });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const parsed = parseTokenQuery(new URL(request.url));
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const store = getStore();
  // Every request, cached or not, counts against a loose per-network limit.
  if (!(await allow(store, "locks-any", [clientIp(request)], 60, 60))) return json({ error: "Too many requests. Slow down a little." }, 429, { "retry-after": "60" });
  const hit = await cache.get(parsed.token);
  if (hit) return json({ ...hit.value, cached: true }, 200, { "cache-control": "public, max-age=60, s-maxage=120" });
  if (!(await allowPublic(store, request, "locks", 6, 60))) return json({ error: "Too many requests. Slow down a little." }, 429, { "retry-after": "60" });
  try {
    const { value, cached } = await cache.wrap(parsed.token, () => tokenLocks(parsed.token), (v) => (v.complete ? TTL : 30));
    return json({ ...value, cached }, 200, { "cache-control": "public, max-age=60, s-maxage=120" });
  } catch {
    return json({ error: "The chain could not be read just now. Try again in a minute." }, 502);
  }
}
