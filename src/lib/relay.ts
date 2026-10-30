import { BRAND, ETH_USD_FEED, USDG, WETH, isAddress } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";
import { HOODLOCK, PONS_ESCROW } from "@/config/sources";
import { MULTICALL3, innerCalls } from "@/lib/multicall";

/*
 * Rules for the read-only JSON-RPC relay, kept apart from the route so they
 * can be tested. Every request is priced in units; each network has a budget.
 */

export const MAX_CALLS = 20;
export const MAX_LOGS_PER_BATCH = 3;
export const MAX_LOG_SPAN = 20_000;
export const MAX_GAS = 5_000_000;
/**
 * Probes: Recla reads and simulates claim sources the visitor names (a Merkle distributor, a vesting wallet, a
 * registered source). An eth_call or eth_estimateGas to an address outside the fixed list is relayed only with an
 * explicit gas of at most PROBE_GAS and small call data, costs PROBE_COST units, and also spends the site-wide probe
 * budget (common-2710 J: user-chosen targets are validated, low gas per call, site-wide bucket).
 */
export const PROBE_GAS = 1_500_000;
export const PROBE_COST = 4;
export const MAX_PROBE_DATA = 8_192;
export const PROBE_BUDGET = { siteUnits: 8_000, windowSec: 600 };

const GAS_CAP_HEX = `0x${MAX_GAS.toString(16)}`;
const CALL_KEYS = new Set(["from", "to", "gas", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "value", "data", "input", "nonce", "type", "chainId"]);
const LOG_KEYS = new Set(["address", "fromBlock", "toBlock", "topics", "blockHash"]);
const BLOCK_TAG = /^(latest|pending|safe|finalized|0x[0-9a-fA-F]{1,16})$/;

/**
 * Normalises a call object before it is checked and forwarded. The node reads `input` as well as
 * `data`, so `input` is folded into `data` (refused when the two disagree) and every size check sees
 * the bytes that will run; a call without `gas` gets the relay cap instead of the node's much higher
 * default. Mutates `tx`; running it twice is harmless.
 */
function shapeTx(tx: Record<string, unknown>): string | null {
  // The node decodes field names case-insensitively ("TO" would override "to"), so only these exact names pass.
  for (const k of Object.keys(tx)) if (!CALL_KEYS.has(k)) return `Unsupported call field: ${k.slice(0, 32)}`;
  if (tx.input !== undefined) {
    if (tx.data !== undefined && tx.data !== tx.input) return "data and input disagree.";
    tx.data = tx.input;
    delete tx.input;
  }
  if (tx.data !== undefined && (typeof tx.data !== "string" || !/^0x[0-9a-fA-F]*$/.test(tx.data))) return "Call data must be hex.";
  if (tx.gas === undefined) tx.gas = GAS_CAP_HEX;
  return null;
}
export const MAX_BODY = 32_768;
export const BUDGET = { units: 600, windowSec: 600, siteUnits: 20_000 };

// eth_getLogs is deliberately absent: the site reads the registry through paginated view calls and builds history on the server (/api/history), so no
// log query of any shape is relayed (the checks below stay as a second line should it ever be added back).
export const COST: Record<string, number> = {
  eth_call: 2,
  eth_getTransactionReceipt: 1,
  eth_blockNumber: 1,
  eth_getBalance: 1,
  eth_chainId: 1,
  eth_gasPrice: 1,
  eth_getBlockByNumber: 1,
  eth_getTransactionCount: 1,
  eth_maxPriorityFeePerGas: 1,
  eth_getCode: 1,
  eth_estimateGas: 3,
};

/** Call data limit in hex characters (the largest site read, a batch of bucket views, is far below this). */
export const MAX_CALL_DATA = 20_000;
const dataLimit = (to: unknown) => (typeof to === "string" ? MAX_CALL_DATA : 0);

/**
 * Contracts the browser reads through the relay without the probe rules: USDG, WETH, the ETH / USD feed, the two
 * built-in claim sources, the token once launched and the ReclaSourceRegistry once deployed. eth_getCode and receipts
 * are answered for any address. */
export function readTargets() {
  const list: string[] = [USDG.address, WETH, ETH_USD_FEED, PONS_ESCROW.address, HOODLOCK.address];
  if (isAddress(BRAND.ca)) list.push(BRAND.ca);
  for (const a of [CONTRACTS.registry]) if (isAddress(a)) list.push(a);
  return new Set(list.map((a) => a.toLowerCase()));
}

/**
 * Multicall3 (aggregate3 only) is relayed when every inner call either reads a fixed target, or is a bare ERC-20
 * metadata view (symbol, name, decimals, totalSupply: 4 bytes, no arguments) on any address. Anything else through
 * Multicall3 is refused: it would turn one relayed call into many probes. Inner calls cost 1 unit per 4, and each
 * inner metadata call on an address outside the list counts as a probe.
 */
export const MAX_MULTICALL_INNER = 48;
const META_SELECTORS = new Set(["0x95d89b41", "0x06fdde03", "0x313ce567", "0x18160ddd"]);
const MULTICALL = MULTICALL3.toLowerCase();

export function checkMulticall(data: unknown, targets: Set<string>): { units: number; probes: number } | { error: string } {
  const calls = typeof data === "string" ? innerCalls(data) : null;
  if (!calls) return { error: "Multicall3 is relayed only for aggregate3." };
  if (calls.length === 0 || calls.length > MAX_MULTICALL_INNER) return { error: `Between 1 and ${MAX_MULTICALL_INNER} calls per multicall.` };
  let probes = 0;
  for (const c of calls) {
    const t = c.target.toLowerCase();
    if (t === MULTICALL) return { error: "Nested multicalls are not relayed." };
    if (targets.has(t)) continue;
    if (c.callData.length === 10 && META_SELECTORS.has(c.callData.toLowerCase())) {
      probes += 1;
      continue;
    }
    return { error: "Multicall3 is relayed only for the site's own contracts and token metadata." };
  }
  return { units: Math.ceil(calls.length / 4), probes };
}

/** Addresses a batch reads (eth_call targets and log filter addresses), lowercased. */
export function namedAddresses(body: Call | Call[]): string[] {
  const calls = Array.isArray(body) ? body : [body];
  const out = new Set<string>();
  for (const c of calls) {
    if (!c || !Array.isArray(c.params)) continue;
    const first = c.params[0] as { to?: unknown; address?: unknown } | undefined;
    if (!first || typeof first !== "object") continue;
    if ((c.method === "eth_call" || c.method === "eth_estimateGas") && typeof first.to === "string") {
      out.add(first.to.toLowerCase());
      // The inner targets of a multicall count as named too, so the priced pass charges before refusing them.
      const data = (first as { data?: unknown }).data;
      if (first.to.toLowerCase() === MULTICALL && typeof data === "string") for (const ic of innerCalls(data) ?? []) out.add(ic.target.toLowerCase());
    }
    if (c.method === "eth_getLogs") {
      const a = first.address;
      for (const x of typeof a === "string" ? [a] : Array.isArray(a) ? a : []) if (typeof x === "string") out.add(x.toLowerCase());
    }
  }
  return [...out].filter((a) => /^0x[0-9a-f]{40}$/.test(a));
}

export type Call = { jsonrpc?: string; id?: unknown; method: string; params?: unknown[] };

const hexBlock = (v: unknown) => (typeof v === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(v) ? Number(BigInt(v)) : null);

/** Checks a batch and returns its cost in units, or the reason it is refused. */
export function checkBatch(calls: Call[], targets = readTargets()): { units: number; probes: number } | { error: string } {
  if (calls.length === 0 || calls.length > MAX_CALLS) return { error: `Between 1 and ${MAX_CALLS} calls per request.` };
  let units = 0;
  let probes = 0;
  /** A call to an address outside the list: allowed only as a probe (explicit low gas, small data). */
  const probe = (tx: { to?: unknown; gas?: unknown; data?: unknown; input?: unknown }): string | null => {
    const gas = typeof tx.gas === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(tx.gas) ? Number(BigInt(tx.gas)) : null;
    if (gas === null) return "Calls to an address outside the site's list need an explicit gas limit.";
    if (gas > PROBE_GAS) return "Gas above the probe cap.";
    const data = typeof tx.data === "string" ? tx.data : typeof tx.input === "string" ? tx.input : "0x";
    if (data.length > MAX_PROBE_DATA) return "Call data too large.";
    if (typeof tx.to !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(tx.to)) return "Call target must be an address.";
    probes += 1;
    units += PROBE_COST;
    return null;
  };
  let logs = 0;
  let span = 0;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    if (!c || typeof c.method !== "string" || !Object.hasOwn(COST, c.method)) return { error: `Method not allowed: ${String(c?.method)}` };
    if (c.params !== undefined && !Array.isArray(c.params)) return { error: "params must be an array." };
    const params = c.params ?? [];
    units += COST[c.method];
    if (c.method === "eth_getLogs") {
      logs += 1;
      if (logs > MAX_LOGS_PER_BATCH) return { error: `At most ${MAX_LOGS_PER_BATCH} log queries per request.` };
      const filter = (params[0] ?? {}) as { address?: unknown; fromBlock?: unknown; toBlock?: unknown; blockHash?: unknown };
      if (typeof filter !== "object" || filter === null || Array.isArray(filter)) return { error: "eth_getLogs needs a filter object." };
      const oddKey = Object.keys(filter).find((k) => !LOG_KEYS.has(k));
      if (oddKey) return { error: `Unsupported filter field: ${oddKey.slice(0, 32)}` };
      if (filter.blockHash !== undefined) return { error: "blockHash filters are not relayed." };
      // An address filter is required and every address must be one the site reads: a topic-only or
      // address-less query would return every log on the chain in the range.
      const addresses = typeof filter.address === "string" ? [filter.address] : Array.isArray(filter.address) ? filter.address : null;
      if (!addresses || addresses.length === 0 || addresses.length > 3) return { error: "eth_getLogs needs an address filter (1 to 3 addresses)." };
      if (!addresses.every((a) => typeof a === "string" && targets.has(a.toLowerCase()))) return { error: "eth_getLogs address not served by this relay." };
      // Both ends must be hex numbers: "latest" or a missing bound would let one request scan the whole chain.
      const from = hexBlock(filter.fromBlock);
      const to = hexBlock(filter.toBlock);
      if (from === null || to === null) return { error: "eth_getLogs needs numeric fromBlock and toBlock." };
      if (to < from) return { error: "toBlock is before fromBlock." };
      span += to - from + 1;
      if (span > MAX_LOG_SPAN) return { error: "Log range too wide." };
      // Priced by the blocks it covers: 1 extra unit per 1,000 blocks.
      units += Math.ceil((to - from + 1) / 1_000);
    }
    if (c.method === "eth_call") {
      if (params.length > 2) return { error: "State overrides are not relayed." };
      const tx = params[0] as { to?: unknown; gas?: unknown; data?: unknown } | undefined;
      if (!tx || typeof tx !== "object") return { error: "eth_call needs a call object." };
      if (typeof tx.to === "string" && tx.to.toLowerCase() === MULTICALL) {
        const shapedM = shapeTx(tx as Record<string, unknown>);
        if (shapedM) return { error: shapedM };
        const m = checkMulticall(tx.data, targets);
        if ("error" in m) return { error: m.error };
        const gas = typeof tx.gas === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(tx.gas) ? Number(BigInt(tx.gas)) : Infinity;
        if (gas > PROBE_GAS) return { error: "Multicalls need an explicit gas limit of at most 1,500,000." };
        if ((tx as { value?: unknown }).value !== undefined) return { error: "Multicalls are relayed without value." };
        units += m.units;
        probes += m.probes;
        units += m.probes * PROBE_COST;
      } else if (typeof tx.to !== "string" || !targets.has(tx.to.toLowerCase())) {
        const why = probe(tx);
        if (why) return { error: why };
      }
      const shaped = shapeTx(tx as Record<string, unknown>);
      if (shaped) return { error: shaped };
      if (params[1] !== undefined && !(typeof params[1] === "string" && BLOCK_TAG.test(params[1]))) return { error: "Unsupported block tag." };
      if (tx.gas !== undefined) {
        const gas = typeof tx.gas === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(tx.gas) ? Number(BigInt(tx.gas)) : Infinity;
        if (gas > MAX_GAS) return { error: "Gas above the relay cap." };
      }
      if (typeof tx.data === "string" && tx.data.length > dataLimit(tx.to)) return { error: "Call data too large." };
    }
    if (c.method === "eth_getBlockByNumber" && params[1] !== false) return { error: "eth_getBlockByNumber is relayed only with full transactions off (false)." };
    if (c.method === "eth_estimateGas") {
      if (params.length > 2) return { error: "State overrides are not relayed." };
      const tx = params[0] as { to?: unknown; gas?: unknown; data?: unknown } | undefined;
      if (!tx || typeof tx !== "object") return { error: "eth_estimateGas needs a transaction." };
      if (typeof tx.to === "string" && tx.to.toLowerCase() === MULTICALL) return { error: "Gas estimates through Multicall3 are not relayed." };
      if (typeof tx.to !== "string" || !targets.has(tx.to.toLowerCase())) {
        const why = probe(tx);
        if (why) return { error: why };
      }
      const shaped = shapeTx(tx as Record<string, unknown>);
      if (shaped) return { error: shaped };
      if (params[1] !== undefined && !(typeof params[1] === "string" && BLOCK_TAG.test(params[1]))) return { error: "Unsupported block tag." };
      if (tx.gas !== undefined) {
        const gas = typeof tx.gas === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(tx.gas) ? Number(BigInt(tx.gas)) : Infinity;
        if (gas > MAX_GAS) return { error: "Gas above the relay cap." };
      }
      if (typeof tx.data === "string" && tx.data.length > dataLimit(tx.to)) return { error: "Call data too large." };
    }
  }
  return { units, probes };
}

export type RpcAnswer = { result: unknown } | { error: { code: number; message: string; data?: string } } | { down: true };

export type RelayDeps = {
  /** Charges the caller's budgets; returns the refusal message, or null when allowed. */
  charge: (units: number) => Promise<string | null>;
  /** Charges the site-wide probe budget for calls to user-named addresses; refusal message or null. */
  chargeProbe: (units: number) => Promise<string | null>;
  one: (method: string, params: unknown[]) => Promise<RpcAnswer>;
  many: (calls: { method: string; params: unknown[] }[]) => Promise<(unknown | null)[]>;
};

/**
 * The relay's whole decision, without I/O of its own: shape and price first, then the budget, then
 * the target allowlist, and only then the upstream RPC. A refused request never reaches the RPC.
 */
export async function runRelay(body: Call | Call[], deps: RelayDeps): Promise<{ status: number; body: unknown }> {
  const calls = Array.isArray(body) ? body : [body];
  const targets = readTargets();
  // Priced with every named address allowed first, so a refused target still costs budget.
  const priced = checkBatch(calls, new Set([...targets, ...namedAddresses(body)]));
  if ("error" in priced) return { status: 400, body: { error: priced.error } };
  const checked = checkBatch(calls, targets);
  // The lenient pass sees no probes, so an allowed batch is charged its strict price: the caller pays for every
  // probe before the site-wide probe budget is spent.
  const refused = await deps.charge("error" in checked ? priced.units : Math.max(priced.units, checked.units));
  if (refused) return { status: 429, body: { error: refused } };
  if ("error" in checked) return { status: 400, body: { error: checked.error } };
  if (checked.probes > 0) {
    const busy = await deps.chargeProbe(checked.probes * PROBE_COST);
    if (busy) return { status: 429, body: { error: busy } };
  }
  if (calls.length === 1 && !Array.isArray(body)) {
    const c = calls[0];
    const a = await deps.one(c.method, c.params ?? []);
    if ("down" in a) return { status: 502, body: { error: "The chain could not be reached." } };
    return { status: 200, body: { jsonrpc: "2.0", id: c.id ?? null, ...a } };
  }
  try {
    const results = await deps.many(calls.map((c) => ({ method: c.method, params: c.params ?? [] })));
    const out = calls.map((c, i) =>
      results[i] === null ? { jsonrpc: "2.0", id: c.id ?? null, error: { code: -32000, message: "read failed" } } : { jsonrpc: "2.0", id: c.id ?? null, result: results[i] },
    );
    return { status: 200, body: Array.isArray(body) ? out : out[0] };
  } catch {
    return { status: 502, body: { error: "The chain could not be reached." } };
  }
}
