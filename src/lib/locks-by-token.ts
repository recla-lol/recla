import { type Abi, type Hex } from "viem";
import { ERC20_ABI, LOCKER_ABI } from "./abi";
import { TOPICS, WINDOW, padTopic, walkLogs, type GetLogs } from "./history";
import { MULTICALL_CHUNK, multicallRead, type CallMany, type Read } from "./multicall";

/*
 * Self-contained module: depends only on viem, ./abi, ./history and ./multicall (no app, config or React imports).
 * The caller supplies the I/O: a log reader (GetLogs), a raw eth_call batch (CallMany) and the latest block number.
 *
 * Locks by token on a HoodLock-style locker (RobinhoodLocker): every Locked event whose third indexed topic is the
 * token, read in wide windows with one value per topic position, then each lock re-read with getLock through
 * Multicall3 so withdrawn locks are dropped. The answer is what the locker holds for the token right now.
 */

/** HoodLock locker on Robinhood Chain and its creation block (the earliest block worth scanning). */
export const HOODLOCK_LOCKER = "0xD0f7d8c6e9f6D80c297bEbe4F7fD1B9C8125C32F";
export const HOODLOCK_START_BLOCK = 4_591_195;

/** Most Locked events read for one token (the whole locker held about 735 locks on 30 Oct 2026). */
export const MAX_TOKEN_LOCKS = 2_000;
/** Upper bound on the 10M-block windows walked, so a far-future chain height cannot make the walk unbounded. */
export const MAX_TOKEN_WINDOWS = 30;

export type TokenLock = {
  id: string;
  owner: string;
  /** Raw amount in the token's smallest unit (decimal string). */
  amount: string;
  /** amount / totalSupply, rounded to 8 decimals; null when the supply is unknown or zero. */
  shareOfSupply: number | null;
  /** Unix seconds. */
  unlockTime: number;
  /** True once the unlock time has passed (the owner may withdraw). */
  unlocked: boolean;
  withdrawn: boolean;
};

export type TokenLocksAnswer = {
  token: string;
  locker: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  totalSupply: string | null;
  /** Active locks (not withdrawn), largest first. */
  locks: TokenLock[];
  /** Sum of the active locks' amounts and its share of the supply. */
  totalLocked: string;
  totalShare: number | null;
  /** Locked events found for the token, and how many of those are already withdrawn or could not be read. */
  found: number;
  withdrawnCount: number;
  unreadableCount: number;
  latest: number;
  scannedFrom: number;
  /** False when the walk stopped early (event cap, window cap); the list may then miss older locks. */
  complete: boolean;
  at: number;
};

export type LocksByTokenDeps = {
  getLogs: GetLogs;
  callMany: CallMany;
  latestBlock: () => Promise<number>;
  /** Unix seconds now (tests pin it). */
  now?: () => number;
};

export type LocksByTokenOptions = { locker?: string; startBlock?: number; maxLocks?: number; chunk?: number };

type LockTuple = { owner: string; token: string; amount: bigint; unlockTime: bigint; withdrawn: boolean };

const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

/** amount / supply as a fraction with 8 decimals, computed in integers. */
export function shareOf(amount: bigint, supply: bigint | null): number | null {
  if (supply === null || supply <= 0n) return null;
  return Number((amount * 100_000_000n) / supply) / 100_000_000;
}

/** Lock ids from Locked logs (topic1), each once, newest event first as returned. */
export function lockIdsFromLogs(logs: { topics: Hex[] }[], topic0: Hex = TOPICS.lockLocked): bigint[] {
  const seen = new Set<string>();
  const out: bigint[] = [];
  for (const l of logs) {
    if (l.topics[0] !== topic0 || typeof l.topics[1] !== "string") continue;
    const id = BigInt(l.topics[1]);
    const k = id.toString();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(id);
  }
  return out;
}

/**
 * Keeps the locks that still hold the token: read, not withdrawn, and for this token (the event said so; the
 * re-read confirms it). Sorted by amount, largest first, then by id.
 */
export function activeLocks(ids: bigint[], reads: unknown[], token: string, supply: bigint | null, now: number): { locks: TokenLock[]; withdrawn: number; unreadable: number } {
  const locks: TokenLock[] = [];
  let withdrawn = 0;
  let unreadable = 0;
  ids.forEach((id, i) => {
    const l = reads[i] as LockTuple | null | undefined;
    if (!l || typeof l !== "object" || typeof l.amount !== "bigint" || typeof l.token !== "string") {
      unreadable++;
      return;
    }
    if (l.token.toLowerCase() !== token.toLowerCase()) {
      unreadable++;
      return;
    }
    if (l.withdrawn) {
      withdrawn++;
      return;
    }
    const unlockTime = Number(l.unlockTime);
    locks.push({ id: id.toString(), owner: l.owner, amount: l.amount.toString(), shareOfSupply: shareOf(l.amount, supply), unlockTime, unlocked: unlockTime <= now, withdrawn: false });
  });
  locks.sort((a, b) => {
    const d = BigInt(b.amount) - BigInt(a.amount);
    return d > 0n ? 1 : d < 0n ? -1 : Number(BigInt(a.id) - BigInt(b.id));
  });
  return { locks, withdrawn, unreadable };
}

/** Active locks of one token on the locker. Throws on a malformed token or when the chain cannot be read. */
export async function locksByToken(token: string, deps: LocksByTokenDeps, opts: LocksByTokenOptions = {}): Promise<TokenLocksAnswer> {
  if (!isAddress(token) || /^0x0{40}$/.test(token)) throw new Error("Give a token contract address (0x + 40 hex).");
  const locker = opts.locker ?? HOODLOCK_LOCKER;
  const start = opts.startBlock ?? HOODLOCK_START_BLOCK;
  const maxLocks = opts.maxLocks ?? MAX_TOKEN_LOCKS;
  const latest = await deps.latestBlock();
  const windowsNeeded = Math.min(MAX_TOKEN_WINDOWS, Math.max(1, Math.ceil((latest - start + 1) / WINDOW)));
  const walk = await walkLogs(deps.getLogs, { address: locker, topics: [TOPICS.lockLocked, null, null, padTopic(token)] }, start, latest, windowsNeeded, maxLocks);
  const ids = lockIdsFromLogs(walk.logs);

  const meta: Read[] = [
    { to: token, abi: ERC20_ABI as Abi, fn: "symbol" },
    { to: token, abi: ERC20_ABI as Abi, fn: "name" },
    { to: token, abi: ERC20_ABI as Abi, fn: "decimals" },
    { to: token, abi: ERC20_ABI as Abi, fn: "totalSupply" },
  ];
  const reads: Read[] = [...meta, ...ids.map((id) => ({ to: locker, abi: LOCKER_ABI as Abi, fn: "getLock", args: [id] }))];
  const out = await multicallRead(deps.callMany, reads, { size: opts.chunk ?? MULTICALL_CHUNK });
  const [sym, name, dec, supply] = out;
  const totalSupply = typeof supply === "bigint" ? supply : null;
  const now = deps.now ? deps.now() : Math.floor(Date.now() / 1000);
  const { locks, withdrawn, unreadable } = activeLocks(ids, out.slice(meta.length), token, totalSupply, now);
  const total = locks.reduce((s, l) => s + BigInt(l.amount), 0n);
  return {
    token,
    locker,
    symbol: typeof sym === "string" ? sym.slice(0, 32) : null,
    name: typeof name === "string" ? name.slice(0, 64) : null,
    decimals: typeof dec === "number" || typeof dec === "bigint" ? Number(dec) : null,
    totalSupply: totalSupply?.toString() ?? null,
    locks,
    totalLocked: total.toString(),
    totalShare: shareOf(total, totalSupply),
    found: ids.length,
    withdrawnCount: withdrawn,
    unreadableCount: unreadable,
    latest,
    scannedFrom: walk.scannedFrom,
    complete: walk.complete,
    at: Date.now(),
  };
}

/** The token from the query, or the reason it is refused. Only `token` is accepted, once, as 0x + 40 hex. */
export function parseTokenQuery(url: URL): { token: string } | { error: string } {
  if (url.search.length > 80) return { error: "Query too long." };
  const keys = [...url.searchParams.keys()];
  if (keys.some((k) => k !== "token")) return { error: "Only the token parameter is accepted." };
  const all = url.searchParams.getAll("token");
  if (all.length !== 1) return { error: "Give exactly one token=0x… parameter." };
  const t = all[0];
  if (!/^0x[0-9a-fA-F]{40}$/.test(t)) return { error: "token must be a contract address: 0x followed by 40 hex characters." };
  if (/^0x0{40}$/.test(t)) return { error: "The zero address is not a token." };
  return { token: t.toLowerCase() };
}
