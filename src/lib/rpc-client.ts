import { decodeFunctionResult, type Hex } from "viem";
import { encodeRead, multicallRead, type Read } from "./multicall";

/*
 * Self-contained module: depends only on viem and ./multicall (and that one on ./abi). No app, config or React
 * imports, so it can be copied into another project and pointed at any list of JSON-RPC endpoints.
 *
 * A small read-only JSON-RPC client with endpoint fallback: the endpoint that answered last is tried first, a revert
 * is final (it is an answer, not an outage), and batches let each entry fail on its own.
 */

export type { Read };

export class ChainError extends Error {
  constructor(
    message: string,
    readonly data: string | null = null,
    readonly final = false,
  ) {
    super(message);
  }
}

type RpcBody = { id?: number; result?: unknown; error?: { message?: string; data?: unknown; code?: number } | string };

/** Revert data from an RPC error object (top level or nested one deep). */
export function errorData(e: { data?: unknown }): string | null {
  if (typeof e.data === "string") return e.data;
  const inner = e.data as { data?: unknown } | null;
  return inner && typeof inner.data === "string" ? inner.data : null;
}

/** Explicit gas on every read (1,500,000): a relay may serve addresses a visitor names only with a low limit. */
export const READ_GAS = "0x16e360";

export type RpcClientOptions = {
  /** Endpoints in order of preference. */
  endpoints: string[];
  /** Largest JSON body of one batch request in characters (a relay may cap request bodies). Default 28,000. */
  maxBatchChars?: number;
  /** Largest number of calls in one batch request. Default 20. */
  maxBatchCalls?: number;
  fetch?: typeof fetch;
};

export type RpcClient = ReturnType<typeof createRpcClient>;

export function createRpcClient(opts: RpcClientOptions) {
  const endpoints = opts.endpoints.filter((u, i, all) => !!u && all.indexOf(u) === i);
  if (endpoints.length === 0) throw new Error("createRpcClient needs at least one endpoint.");
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const maxChars = opts.maxBatchChars ?? 28_000;
  const maxCalls = opts.maxBatchCalls ?? 20;
  let preferred = 0;

  /** One JSON-RPC call with endpoint fallback. A revert is final (not retried elsewhere). */
  async function call<T>(method: string, params: unknown[]): Promise<T> {
    let last: unknown = null;
    for (let n = 0; n < endpoints.length; n++) {
      const index = (preferred + n) % endpoints.length;
      try {
        const res = await doFetch(endpoints[index], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store" });
        const body = (await res.json().catch(() => null)) as RpcBody | null;
        if (!body) throw new Error(`RPC ${res.status}`);
        if (typeof body.error === "string") throw new Error(body.error);
        if (body.error) {
          const final = body.error.code === 3 || /revert/i.test(body.error.message ?? "");
          throw new ChainError(body.error.message ?? "RPC error", errorData(body.error), final);
        }
        preferred = index;
        return body.result as T;
      } catch (error) {
        if (error instanceof ChainError && error.final) throw error;
        last = error;
      }
    }
    throw last instanceof Error ? last : new Error("The chain could not be reached.");
  }

  /** One batch request where each entry may fail on its own (null), with endpoint fallback for the whole batch. */
  async function batchOnce(calls: { method: string; params: unknown[] }[]): Promise<(unknown | null)[]> {
    let last: unknown = null;
    for (let n = 0; n < endpoints.length; n++) {
      const index = (preferred + n) % endpoints.length;
      try {
        const res = await doFetch(endpoints[index], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, ...c }))), cache: "no-store" });
        const body = (await res.json().catch(() => null)) as RpcBody[] | RpcBody | null;
        if (!Array.isArray(body)) throw new Error(typeof body?.error === "string" ? body.error : `RPC ${res.status}`);
        const out: (unknown | null)[] = calls.map(() => null);
        for (const e of body) if (typeof e.id === "number" && e.id >= 0 && e.id < calls.length && !e.error && e.result !== undefined) out[e.id] = e.result;
        preferred = index;
        return out;
      } catch (error) {
        last = error;
      }
    }
    throw last instanceof Error ? last : new Error("The chain could not be reached.");
  }

  /** Any number of calls, split into batch requests under the size and count limits. */
  async function batchLoose(calls: { method: string; params: unknown[] }[]): Promise<(unknown | null)[]> {
    if (calls.length === 0) return [];
    const groups: { method: string; params: unknown[] }[][] = [];
    let cur: { method: string; params: unknown[] }[] = [];
    let size = 2;
    for (const c of calls) {
      const len = JSON.stringify(c).length + 32;
      if (cur.length && (cur.length >= maxCalls || size + len > maxChars)) {
        groups.push(cur);
        cur = [];
        size = 2;
      }
      cur.push(c);
      size += len;
    }
    if (cur.length) groups.push(cur);
    const out: (unknown | null)[] = [];
    for (const g of groups) out.push(...(await batchOnce(g)));
    return out;
  }

  async function read<T>(r: Read): Promise<T> {
    const raw = await call<Hex>("eth_call", [{ to: r.to, data: encodeRead(r), gas: READ_GAS }, "latest"]);
    return decodeFunctionResult({ abi: r.abi, functionName: r.fn, data: raw } as never) as T;
  }

  /** Many reads as plain eth_calls in batches; a read that fails or does not decode is null. */
  async function readMany(reads: Read[]): Promise<unknown[]> {
    const raw = await batchLoose(reads.map((r) => ({ method: "eth_call", params: [{ to: r.to, data: encodeRead(r), gas: READ_GAS }, "latest"] })));
    return reads.map((r, k) => {
      try {
        return typeof raw[k] === "string" && (raw[k] as string).length > 2 ? decodeFunctionResult({ abi: r.abi, functionName: r.fn, data: raw[k] as Hex } as never) : null;
      } catch {
        return null;
      }
    });
  }

  /**
   * Many reads packed into Multicall3 aggregate3 calls (`size` per call). A chunk Multicall3 cannot answer falls back
   * to plain batched eth_calls, so a chain without Multicall3 still reads.
   */
  async function readMulticall(reads: Read[], size?: number): Promise<unknown[]> {
    return multicallRead(
      async (calls) => (await batchLoose(calls.map((c) => ({ method: "eth_call", params: [{ to: c.to, data: c.data, gas: READ_GAS }, "latest"] })))).map((v) => (typeof v === "string" ? (v as Hex) : null)),
      reads,
      { size, fallback: readMany },
    );
  }

  return { call, batchLoose, read, readMany, readMulticall, endpoints };
}
