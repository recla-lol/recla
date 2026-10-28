import { NextResponse } from "next/server";
import { allowPublic, tooMany } from "@/lib/guard";
import { getStore } from "@/lib/server/store";
import { rpc } from "@/lib/feeds/rpc";
import { CHAIN } from "@/config/brand";

export const dynamic = "force-dynamic";

/*
 * Claim Verification facts for one contract: GET /api/source?address=0x…
 * - hasCode: eth_getCode on Robinhood Chain now.
 * - verified: whether Sourcify (keyless, chain 4663) holds a verified source for it, with the contract name. The
 *   Robinhood Chain explorer sits behind a bot wall from servers, so "not on Sourcify" is shown as "unknown", never as
 *   "unverified".
 * Cached 30 minutes per address.
 */

type Facts = { address: string; hasCode: boolean | null; codeSize: number | null; verified: "full" | "partial" | "unknown"; contractName: string | null; at: number };
const cache = new Map<string, { at: number; value: Facts }>();
const TTL = 30 * 60_000;

async function sourcify(address: string): Promise<{ verified: Facts["verified"]; name: string | null }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://sourcify.dev/server/v2/contract/${CHAIN.id}/${address}?fields=compilation`, { headers: { accept: "application/json" }, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return { verified: "unknown", name: null };
    const j = (await res.json()) as { match?: string; runtimeMatch?: string; compilation?: { name?: string } };
    const m = j.match ?? j.runtimeMatch;
    const name = typeof j.compilation?.name === "string" ? j.compilation.name.slice(0, 64) : null;
    return { verified: m === "exact_match" || m === "match" ? (m === "exact_match" ? "full" : "partial") : "unknown", name };
  } catch {
    return { verified: "unknown", name: null };
  } finally {
    clearTimeout(t);
  }
}

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: "Give a 0x address." }, { status: 400 });
  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.value);
  if (!(await allowPublic(getStore(), request, "source", 20, 300))) return tooMany();
  const [code, sf] = await Promise.all([rpc<string>("eth_getCode", [address, "latest"]).catch(() => null), sourcify(address)]);
  const value: Facts = {
    address,
    hasCode: typeof code === "string" ? code.length > 2 : null,
    codeSize: typeof code === "string" ? (code.length - 2) / 2 : null,
    verified: sf.verified,
    contractName: sf.name,
    at: Date.now(),
  };
  if (cache.size > 5_000) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
  return NextResponse.json(value);
}
