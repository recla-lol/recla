import { NextResponse } from "next/server";
import { allowPublic, tooMany } from "@/lib/guard";
import { getStore } from "@/lib/server/store";
import { sourceHistory, walletHistory, type HistoryAnswer } from "@/lib/server/history";

export const dynamic = "force-dynamic";

/*
 * Claim History for one wallet: GET /api/history?address=0x… (built-in sources + registry), or
 * GET /api/history?address=0x…&source=0x…&kind=merkle|vesting for a source the visitor names.
 * Each answer walks up to eleven 10M-block windows on the chain, so answers are cached for 10 minutes per query and
 * limited per network and site-wide.
 */

const TTL = 10 * 60_000;
const cache = new Map<string, { at: number; ttl: number; value: HistoryAnswer }>();
const inflight = new Map<string, Promise<HistoryAnswer>>();
const isAddr = (v: string | null): v is string => !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address");
  const source = url.searchParams.get("source");
  const kind = url.searchParams.get("kind");
  if (!isAddr(address)) return NextResponse.json({ error: "Give a 0x address." }, { status: 400 });
  if (source !== null && (!isAddr(source) || (kind !== "merkle" && kind !== "vesting"))) return NextResponse.json({ error: "A named source needs a 0x address and kind merkle or vesting." }, { status: 400 });
  const key = `${address.toLowerCase()}|${source?.toLowerCase() ?? ""}|${kind ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return NextResponse.json({ ...hit.value, cached: true }, { headers: { "cache-control": "no-store" } });
  if (!(await allowPublic(getStore(), request, "history", 6, 120))) return tooMany();
  let job = inflight.get(key);
  if (!job) {
    job = (source ? sourceHistory(address, source, kind as "merkle" | "vesting") : walletHistory(address)).finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  try {
    const value = await job;
    if (cache.size > 2_000) cache.delete(cache.keys().next().value as string);
    // An answer with a source that could not be read is kept only briefly, so a passing RPC hiccup heals fast.
    cache.set(key, { at: Date.now(), ttl: value.sources.every((s) => s.ok) ? TTL : 30_000, value });
    return NextResponse.json({ ...value, cached: false }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The chain could not be read just now. Try again in a minute." }, { status: 502 });
  }
}
