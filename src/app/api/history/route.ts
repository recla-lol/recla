import { NextResponse } from "next/server";
import { allowPublic, tooMany } from "@/lib/guard";
import { createCache } from "@/lib/server/cache";
import { getStore } from "@/lib/server/store";
import { sourceHistory, walletHistory, type HistoryAnswer } from "@/lib/server/history";

export const dynamic = "force-dynamic";
/** A cold answer walks up to eleven 10M-block windows per source. */
export const maxDuration = 60;

/*
 * Claim History for one wallet: GET /api/history?address=0x… (built-in sources + registry), or
 * GET /api/history?address=0x…&source=0x…&kind=merkle|vesting for a source the visitor names.
 * Each answer walks up to eleven 10M-block windows on the chain, so answers are cached for 10 minutes per query (in
 * memory and in the shared store when one is configured) and cold answers are limited per network and site-wide.
 */

const TTL = 10 * 60;
const cache = createCache<HistoryAnswer>("history", getStore, 2_000);
const isAddr = (v: string | null): v is string => !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address");
  const source = url.searchParams.get("source");
  const kind = url.searchParams.get("kind");
  if (!isAddr(address)) return NextResponse.json({ error: "Give a 0x address." }, { status: 400 });
  if (source !== null && (!isAddr(source) || (kind !== "merkle" && kind !== "vesting"))) return NextResponse.json({ error: "A named source needs a 0x address and kind merkle or vesting." }, { status: 400 });
  const key = `${address.toLowerCase()}|${source?.toLowerCase() ?? ""}|${source ? kind : ""}`;
  const hit = await cache.get(key);
  if (hit) return NextResponse.json({ ...hit.value, cached: true }, { headers: { "cache-control": "no-store" } });
  if (!(await allowPublic(getStore(), request, "history", 6, 120))) return tooMany();
  try {
    // An answer with a source that could not be read is kept only briefly, so a passing RPC hiccup heals fast.
    const { value, cached } = await cache.wrap(key, () => (source ? sourceHistory(address, source, kind as "merkle" | "vesting") : walletHistory(address)), (v) => (v.sources.every((s) => s.ok) ? TTL : 30));
    return NextResponse.json({ ...value, cached }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The chain could not be read just now. Try again in a minute." }, { status: 502 });
  }
}
