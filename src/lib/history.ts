import { decodeEventLog, toEventSelector, type Abi, type Hex } from "viem";
import { ESCROW_ABI, LOCKER_ABI, MERKLE_ABI, REGISTRY_ABI, VESTING_ABI } from "./abi";

/*
 * Self-contained module: depends only on viem and ./abi (no app, config or React imports), so it can be copied into
 * another project. The log reader (GetLogs) is supplied by the caller.
 *
 * Claim History: the exact log filters the server issues for a wallet, and how their answers are read. Filters are
 * built here from fixed event selectors and the wallet's padded address (never from caller input), as the relay
 * rules of common-2710 J require. The official Robinhood Chain RPC answers one query over at most 10,000,000 blocks
 * and 10,000 logs, so a range is walked in windows from the newest block back to the source's creation block, and a
 * window that matches too many logs is split in half (bounded depth).
 */

export const WINDOW = 10_000_000;
export const MAX_WINDOWS = 11;
export const MAX_SPLIT_DEPTH = 6;
export const MAX_EVENTS = 200;

export type LogFilter = { address: string; topics: (Hex | Hex[] | null)[] };
export type RawLog = { address: string; topics: Hex[]; data: Hex; blockNumber: Hex; transactionHash: Hex; logIndex: Hex };
export type GetLogs = (f: LogFilter & { fromBlock: number; toBlock: number }) => Promise<RawLog[]>;

const sel = (abi: Abi, name: string) => {
  const ev = abi.find((x) => x.type === "event" && x.name === name);
  if (!ev) throw new Error(`no event ${name}`);
  return toEventSelector(ev as never);
};

export const TOPICS = {
  ponsClaimed: sel(ESCROW_ABI as Abi, "Claimed"),
  ponsClaimedToken: sel(ESCROW_ABI as Abi, "ClaimedToken"),
  ponsCreditedToken: sel(ESCROW_ABI as Abi, "CreditedToken"),
  lockLocked: sel(LOCKER_ABI as Abi, "Locked"),
  lockWithdrawn: sel(LOCKER_ABI as Abi, "Withdrawn"),
  merkleClaimed: sel(MERKLE_ABI as Abi, "Claimed"),
  vestEther: sel(VESTING_ABI as Abi, "EtherReleased"),
  vestErc20: sel(VESTING_ABI as Abi, "ERC20Released"),
  regRegistered: sel(REGISTRY_ABI as Abi, "SourceRegistered"),
  regAttested: sel(REGISTRY_ABI as Abi, "Attested"),
  regFlagged: sel(REGISTRY_ABI as Abi, "Flagged"),
} as const;

/** Every topic0 the server may ever ask for. Anything else is refused before reaching the RPC. */
export const ALLOWED_TOPIC0 = new Set<string>(Object.values(TOPICS));

export const padTopic = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}` as Hex;

/**
 * True when a filter has the only shape the server issues: a single address, one known topic0, and at most padded
 * addresses in the other positions. One value per position: the official RPC allows a 10M-block span only then.
 */
export function filterShapeOk(f: LogFilter): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(f.address)) return false;
  const t0 = f.topics[0];
  if (typeof t0 !== "string" || !ALLOWED_TOPIC0.has(t0)) return false;
  return f.topics.slice(1).every((t) => t === null || (typeof t === "string" && /^0x0{24}[0-9a-f]{40}$/.test(t)));
}

/** Windows [from, to] walking back from `latest` to `start`, newest first, at most MAX_WINDOWS. */
export function windows(start: number, latest: number, span = WINDOW, max = MAX_WINDOWS): [number, number][] {
  const out: [number, number][] = [];
  let to = latest;
  while (to >= start && out.length < max) {
    const from = Math.max(start, to - span + 1);
    out.push([from, to]);
    to = from - 1;
  }
  return out;
}

const tooMany = (e: unknown) => e instanceof Error && /exceed|limit|too many|more than/i.test(e.message);

/** Logs of one window; a window over the node's match limit is split in half, down to MAX_SPLIT_DEPTH. */
export async function logsInWindow(get: GetLogs, f: LogFilter, from: number, to: number, depth = 0, maxEvents = MAX_EVENTS): Promise<{ logs: RawLog[]; partial: boolean }> {
  try {
    return { logs: await get({ ...f, fromBlock: from, toBlock: to }), partial: false };
  } catch (e) {
    if (!tooMany(e) || depth >= MAX_SPLIT_DEPTH || to <= from) throw e;
    const mid = Math.floor((from + to) / 2);
    // Newest half first, so a cap on events keeps the most recent ones.
    const hi = await logsInWindow(get, f, mid + 1, to, depth + 1, maxEvents);
    if (hi.logs.length >= maxEvents) return { logs: hi.logs, partial: true };
    const lo = await logsInWindow(get, f, from, mid, depth + 1, maxEvents);
    return { logs: [...hi.logs, ...lo.logs], partial: hi.partial || lo.partial };
  }
}

/** Walks windows newest first until `maxEvents` logs are found or the start block is reached. */
export async function walkLogs(get: GetLogs, f: LogFilter, start: number, latest: number, maxWindows = MAX_WINDOWS, maxEvents = MAX_EVENTS): Promise<{ logs: RawLog[]; scannedFrom: number; complete: boolean }> {
  if (!filterShapeOk(f)) throw new Error("Refused log filter shape.");
  const ws = windows(start, latest, WINDOW, maxWindows);
  const logs: RawLog[] = [];
  let scannedFrom = latest + 1;
  let complete = true;
  for (const [from, to] of ws) {
    const r = await logsInWindow(get, f, from, to, 0, maxEvents);
    logs.push(...r.logs);
    scannedFrom = from;
    if (r.partial) complete = false;
    if (logs.length >= maxEvents) {
      complete = false;
      break;
    }
  }
  if (scannedFrom > start) complete = false;
  return { logs: logs.slice(0, maxEvents), scannedFrom, complete };
}

export type HistoryEvent = {
  source: string;
  kind: string;
  label: string;
  block: number;
  tx: Hex;
  amount: string | null;
  token: string | null;
  ref: string | null;
};

const ABIS: Record<string, Abi> = {
  [TOPICS.ponsClaimed]: ESCROW_ABI as Abi,
  [TOPICS.ponsClaimedToken]: ESCROW_ABI as Abi,
  [TOPICS.ponsCreditedToken]: ESCROW_ABI as Abi,
  [TOPICS.lockLocked]: LOCKER_ABI as Abi,
  [TOPICS.lockWithdrawn]: LOCKER_ABI as Abi,
  [TOPICS.merkleClaimed]: MERKLE_ABI as Abi,
  [TOPICS.vestEther]: VESTING_ABI as Abi,
  [TOPICS.vestErc20]: VESTING_ABI as Abi,
  [TOPICS.regRegistered]: REGISTRY_ABI as Abi,
  [TOPICS.regAttested]: REGISTRY_ABI as Abi,
  [TOPICS.regFlagged]: REGISTRY_ABI as Abi,
};

const LABELS: Record<string, string> = {
  Claimed: "Claimed",
  ClaimedToken: "Claimed token",
  CreditedToken: "Credited token",
  Locked: "Locked",
  Withdrawn: "Withdrawn",
  EtherReleased: "Released ETH",
  ERC20Released: "Released token",
  SourceRegistered: "Registered a source",
  Attested: "Attested an entry",
  Flagged: "Flagged an entry",
};

/** Decodes a log into a history row. `account` filters Merkle claims, whose account is not an indexed topic. */
export function toEvent(log: RawLog, sourceKey: string, account?: string): HistoryEvent | null {
  const abi = ABIS[log.topics[0]];
  if (!abi) return null;
  let d: { eventName: string; args: Record<string, unknown> };
  try {
    d = decodeEventLog({ abi, data: log.data, topics: log.topics as [Hex, ...Hex[]] }) as never;
  } catch {
    return null;
  }
  const a = d.args;
  if (d.eventName === "Claimed" && "account" in a && account && String(a.account).toLowerCase() !== account.toLowerCase()) return null;
  const amount = typeof a.amount === "bigint" ? a.amount.toString() : null;
  const token = typeof a.token === "string" ? a.token : null;
  const ref = typeof a.id === "bigint" ? `#${a.id}` : typeof a.index === "bigint" ? `leaf ${a.index}` : null;
  return { source: sourceKey, kind: d.eventName, label: LABELS[d.eventName] ?? d.eventName, block: Number(BigInt(log.blockNumber)), tx: log.transactionHash, amount, token, ref };
}
