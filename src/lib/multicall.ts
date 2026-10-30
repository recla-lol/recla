import { decodeFunctionData, decodeFunctionResult, encodeFunctionData, type Abi, type Hex } from "viem";
import { MULTICALL3, MULTICALL3_ABI } from "./abi";

/*
 * Self-contained module: depends only on viem and ./abi (no app, config or React imports), so the pair can be copied
 * into another project as is.
 *
 * Multicall3 helpers: many view reads packed into one aggregate3 eth_call, every inner call with allowFailure = true,
 * so one failing read returns null for itself instead of reverting the whole batch.
 */

export { MULTICALL3 };

export type Read = { to: string; abi: Abi; fn: string; args?: readonly unknown[] };

export const encodeRead = (r: Read): Hex => encodeFunctionData({ abi: r.abi, functionName: r.fn, args: r.args ?? [] } as never);

/** Inner calls per aggregate3 call. Small enough for a 1.5M gas read and about 9 KB of calldata. */
export const MULTICALL_CHUNK = 40;

export const AGGREGATE3_SELECTOR = "0x82ad56cb";

/** Splits a list into pieces of at most `size` items. */
export function chunk<T>(list: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be at least 1");
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Calldata of aggregate3 for these reads (each allowed to fail on its own). */
export function encodeAggregate3(reads: readonly Read[]): Hex {
  return encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: "aggregate3",
    args: [reads.map((r) => ({ target: r.to as `0x${string}`, allowFailure: true, callData: encodeRead(r) }))],
  });
}

/** Decodes an aggregate3 answer into one value per read: the decoded result, or null where the read failed. */
export function decodeAggregate3(reads: readonly Read[], returned: Hex | null | undefined): unknown[] {
  if (!returned || returned === "0x") return reads.map(() => null);
  let results: readonly { success: boolean; returnData: Hex }[];
  try {
    results = decodeFunctionResult({ abi: MULTICALL3_ABI, functionName: "aggregate3", data: returned }) as never;
  } catch {
    return reads.map(() => null);
  }
  if (results.length !== reads.length) return reads.map(() => null);
  return reads.map((r, i) => {
    const res = results[i];
    if (!res.success || res.returnData.length <= 2) return null;
    try {
      return decodeFunctionResult({ abi: r.abi, functionName: r.fn, data: res.returnData } as never);
    } catch {
      return null;
    }
  });
}

/** The inner calls of aggregate3 calldata, or null when the data is not an aggregate3 call. */
export function innerCalls(data: string): { target: string; callData: Hex }[] | null {
  if (typeof data !== "string" || !data.toLowerCase().startsWith(AGGREGATE3_SELECTOR)) return null;
  try {
    const d = decodeFunctionData({ abi: MULTICALL3_ABI, data: data as Hex });
    if (d.functionName !== "aggregate3") return null;
    const [calls] = d.args as unknown as [readonly { target: string; callData: Hex }[]];
    return calls.map((c) => ({ target: c.target, callData: c.callData }));
  } catch {
    return null;
  }
}

/** Sends eth_calls (to, data) and returns the raw answers, null where one failed. Supplied by the caller. */
export type CallMany = (calls: { to: string; data: Hex }[]) => Promise<(Hex | null)[]>;

/**
 * Reads through Multicall3 in chunks of `size`. A chunk whose aggregate3 call fails as a whole (no Multicall3 on a
 * local chain, an endpoint hiccup) is retried once as plain single calls through `fallback`, when one is given.
 */
export async function multicallRead(callMany: CallMany, reads: readonly Read[], opts: { size?: number; fallback?: (reads: Read[]) => Promise<unknown[]> } = {}): Promise<unknown[]> {
  if (reads.length === 0) return [];
  const pieces = chunk(reads, opts.size ?? MULTICALL_CHUNK);
  const raw = await callMany(pieces.map((p) => ({ to: MULTICALL3, data: encodeAggregate3(p) })));
  const out: unknown[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const r = raw[i];
    if ((!r || r === "0x") && opts.fallback) out.push(...(await opts.fallback(pieces[i])));
    else out.push(...decodeAggregate3(pieces[i], r));
  }
  return out;
}
