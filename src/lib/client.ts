import { decodeErrorResult, type Abi } from "viem";
import { CHAIN } from "@/config/brand";
import { ALL_ERRORS, ERROR_WORDS } from "@/lib/abi";
import { encodeRead } from "@/lib/multicall";
import { ChainError, READ_GAS, createRpcClient, errorData, type Read } from "@/lib/rpc-client";

/*
 * Browser-side reads. They go through the site relay first (some networks intercept the chain's public
 * RPC host), then the configured RPC, then the public fallback.
 */

// A local test chain (anvil) gets no mainnet fallback, so reads never mix two chains.
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/.test(CHAIN.rpc);
const ENDPOINTS = LOCAL ? ["/api/rpc", CHAIN.rpc] : ["/api/rpc", CHAIN.rpc, CHAIN.fallbackRpc];

/** The site's read client (src/lib/rpc-client.ts, wired to the relay and the chain's endpoints). */
// The relay caps a request body at 32 KB, so batches stay under 28,000 characters.
export const client = createRpcClient({ endpoints: ENDPOINTS, maxBatchChars: 28_000, maxBatchCalls: 20 });

export { ChainError, READ_GAS, type Read };
export const rpcCall = client.call;
export const rpcBatchLoose = client.batchLoose;
export const read = client.read;
export const readMany = client.readMany;
export const readMulticall = client.readMulticall;
export { encodeRead };

/** Waits for a transaction receipt; resolves its status. */
export async function waitForReceipt(hash: string, timeoutMs = 120_000): Promise<{ ok: boolean; blockNumber: number; contractAddress: string | null }> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const r = await rpcCall<{ status: string; blockNumber: string; contractAddress: string | null } | null>("eth_getTransactionReceipt", [hash]).catch(() => null);
    if (r) return { ok: r.status === "0x1", blockNumber: Number(BigInt(r.blockNumber)), contractAddress: r.contractAddress };
    await new Promise((res) => setTimeout(res, 1200));
  }
  throw new Error("No receipt yet. The transaction may still land; check the explorer.");
}

/** Plain words for a revert from the registry or a known source, or the wallet's own message. */
export function explain(cause: unknown): string {
  const e = cause as { code?: number; message?: string; data?: unknown; cause?: unknown } | null;
  if (e?.code === 4001) return "The request was declined in the wallet.";
  const data = e instanceof ChainError ? e.data : typeof e?.data === "string" ? e.data : errorData((e ?? {}) as { data?: unknown });
  if (data && data.length >= 10) {
    try {
      const d = decodeErrorResult({ abi: ALL_ERRORS as Abi, data: data as `0x${string}` });
      return ERROR_WORDS[d.errorName] ?? d.errorName;
    } catch {
      // not one of ours
    }
  }
  const msg = e?.message ?? "Something went wrong.";
  return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
}
