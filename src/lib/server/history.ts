import "server-only";
import { HOODLOCK, PONS_ESCROW } from "@/config/sources";
import { CONTRACTS, registryLive } from "@/config/contracts";
import { RpcError, rpc, rpcCapped } from "@/lib/feeds/rpc";
import { TOPICS, padTopic, toEvent, walkLogs, type GetLogs, type HistoryEvent, type LogFilter, type RawLog } from "@/lib/history";

/*
 * Server side of Claim History. Each source has a fixed filter shape: the wallet's address goes into the indexed
 * topic the event declares for it. User-named sources (a Merkle distributor, a vesting wallet) are read without an
 * account topic because those events do not index the account; their scan is limited to the newest windows.
 */

export type SourceHistory = {
  key: string;
  name: string;
  address: string;
  ok: boolean;
  error: string | null;
  events: HistoryEvent[];
  scannedFrom: number | null;
  complete: boolean;
};

export type HistoryAnswer = { account: string; latest: number; at: number; sources: SourceHistory[]; creditedTokens: string[] };

const hex = (n: number) => `0x${n.toString(16)}`;

const rawGetLogs: GetLogs = (f) =>
  rpcCapped<RawLog[]>("eth_getLogs", [{ address: f.address, topics: f.topics, fromBlock: hex(f.fromBlock), toBlock: hex(f.toBlock) }], 1_500_000, () => new RpcError("Too many logs in one answer; the window will be split.", true));

// The official endpoint answers wide log queries but rate-limits bursts: at most 2 queries at a time, and a query
// refused for a reason other than its shape is retried twice with a short pause.
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await job();
  } finally {
    running--;
    waiting.shift()?.();
  }
}
const getLogs: GetLogs = async (f) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await slot(() => rawGetLogs(f));
    } catch (e) {
      const final = e instanceof RpcError && e.revert;
      if (final || attempt >= 2) throw e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
};

/**
 * One source = one or more filters with a single value per topic position (the official RPC allows a 10M-block span
 * only then; a list of topic0 values drops the span to 100k blocks). Their events are merged, newest first.
 */
async function one(key: string, name: string, filters: LogFilter[], start: number, latest: number, account?: string, maxWindows?: number): Promise<SourceHistory> {
  const address = filters[0].address;
  try {
    const events: HistoryEvent[] = [];
    let scannedFrom = start;
    let complete = true;
    const results = await Promise.all(filters.map((f) => walkLogs(getLogs, f, start, latest, maxWindows)));
    for (const r of results) {
      events.push(...r.logs.map((l) => toEvent(l, key, account)).filter((e): e is HistoryEvent => e !== null));
      scannedFrom = Math.max(scannedFrom, r.scannedFrom);
      complete &&= r.complete;
    }
    return { key, name, address, ok: true, error: null, events: events.sort((a, b) => b.block - a.block), scannedFrom, complete };
  } catch (e) {
    return { key, name, address, ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "read failed", events: [], scannedFrom: null, complete: false };
  }
}

/** Built-in sources (+ the registry once deployed) for one wallet. */
export async function walletHistory(account: string): Promise<HistoryAnswer> {
  const latest = Number(BigInt(await rpc<string>("eth_blockNumber", [])));
  const me = padTopic(account);
  const jobs: Promise<SourceHistory>[] = [
    one(
      "pons",
      PONS_ESCROW.name,
      [
        { address: PONS_ESCROW.address, topics: [TOPICS.ponsClaimed, me] },
        { address: PONS_ESCROW.address, topics: [TOPICS.ponsClaimedToken, me] },
      ],
      PONS_ESCROW.deployBlock,
      latest,
    ),
    one("pons-credit", `${PONS_ESCROW.name} (token credits)`, [{ address: PONS_ESCROW.address, topics: [TOPICS.ponsCreditedToken, me] }], PONS_ESCROW.deployBlock, latest),
    one(
      "hoodlock",
      HOODLOCK.name,
      [
        { address: HOODLOCK.address, topics: [TOPICS.lockLocked, null, me] },
        { address: HOODLOCK.address, topics: [TOPICS.lockWithdrawn, null, me] },
      ],
      HOODLOCK.deployBlock,
      latest,
    ),
  ];
  if (registryLive()) {
    const start = Math.max(1, CONTRACTS.registryBlock);
    jobs.push(one("registry", "Recla registry (your entries)", [{ address: CONTRACTS.registry, topics: [TOPICS.regRegistered, null, null, me] }], start, latest));
    jobs.push(
      one(
        "registry-votes",
        "Recla registry (your responses)",
        [
          { address: CONTRACTS.registry, topics: [TOPICS.regAttested, null, me] },
          { address: CONTRACTS.registry, topics: [TOPICS.regFlagged, null, me] },
        ],
        start,
        latest,
      ),
    );
  }
  const sources = await Promise.all(jobs);
  const credit = sources.find((s) => s.key === "pons-credit");
  const creditedTokens = [...new Set((credit?.events ?? []).map((e) => e.token?.toLowerCase()).filter((t): t is string => !!t))].slice(0, 12);
  return { account, latest, at: Date.now(), sources, creditedTokens };
}

/** A source the user names: Merkle claims (filtered by account after decoding) or vesting releases. Newest 3 windows. */
export async function sourceHistory(account: string, source: string, kind: "merkle" | "vesting"): Promise<HistoryAnswer> {
  const latest = Number(BigInt(await rpc<string>("eth_blockNumber", [])));
  const fs: LogFilter[] = kind === "merkle" ? [{ address: source, topics: [TOPICS.merkleClaimed] }] : [{ address: source, topics: [TOPICS.vestEther] }, { address: source, topics: [TOPICS.vestErc20] }];
  const s = await one(kind, kind === "merkle" ? "Merkle distributor" : "Vesting wallet", fs, 1, latest, kind === "merkle" ? account : undefined, 3);
  return { account, latest, at: Date.now(), sources: [s], creditedTokens: [] };
}
