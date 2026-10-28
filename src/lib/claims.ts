import { encodeFunctionData, getAddress, zeroAddress, type Abi, type Hex } from "viem";
import { USDG, isAddress } from "@/config/brand";
import { HOODLOCK, PONS_ESCROW } from "@/config/sources";
import { ERC20_ABI, ESCROW_ABI, LOCKER_ABI, MERKLE_ABI, REFUND_ABI, VESTING_ABI } from "@/lib/abi";
import { rpcCall, readMany, type Read } from "@/lib/client";
import { claimRoot, type Claim } from "@/lib/merkle";

/*
 * Claim discovery for SUPPORTED sources only. Each adapter has its own read path, confirmed against the contract's
 * verified source; nothing is guessed from a token name. A row describes what the contract itself says an address can
 * claim right now, plus the exact transaction that would claim it. Recla never sends that transaction: the simulator
 * dry-runs it from the address, and only the wallet owner can sign it.
 */

export type TokenInfo = { address: `0x${string}` | null; symbol: string; decimals: number };
export const ETH: TokenInfo = { address: null, symbol: "ETH", decimals: 18 };

export type ClaimStatus = "claimable" | "locked" | "claimed" | "empty" | "unreadable";

export type ClaimRow = {
  id: string;
  sourceKey: string;
  sourceName: string;
  source: `0x${string}`;
  title: string;
  status: ClaimStatus;
  amount: bigint;
  token: TokenInfo;
  /** One line on why the row has this status, in the contract's own terms. */
  why: string;
  /** The call that claims it (dry-run in the simulator, signed only in the user's wallet). */
  action: { label: string; to: `0x${string}`; data: Hex } | null;
  unlockAt?: number;
  link?: { label: string; href: string };
};

const tokenCache = new Map<string, TokenInfo>();

/** Symbol and decimals of an ERC-20, read on chain (cached). Unknown => "?" with 18 decimals, said in the UI. */
export async function tokenInfo(address: string): Promise<TokenInfo> {
  const key = address.toLowerCase();
  const hit = tokenCache.get(key);
  if (hit) return hit;
  if (key === USDG.address.toLowerCase()) {
    const t = { address: getAddress(address), symbol: USDG.symbol, decimals: USDG.decimals };
    tokenCache.set(key, t);
    return t;
  }
  const [sym, dec] = await readMany([
    { to: address, abi: ERC20_ABI as Abi, fn: "symbol" },
    { to: address, abi: ERC20_ABI as Abi, fn: "decimals" },
  ]).catch(() => [null, null]);
  const t: TokenInfo = { address: getAddress(address), symbol: typeof sym === "string" && sym.length <= 16 ? sym : "?", decimals: typeof dec === "number" || typeof dec === "bigint" ? Number(dec) : 18 };
  tokenCache.set(key, t);
  return t;
}

const enc = (abi: Abi, functionName: string, args: unknown[] = []) => encodeFunctionData({ abi, functionName, args } as never);

/** Pons creator fee escrow: ETH plus any pair token. Token list = USDG + tokens seen in this address's credits. */
export async function readPonsEscrow(account: `0x${string}`, extraTokens: string[] = []): Promise<ClaimRow[]> {
  const to = PONS_ESCROW.address as `0x${string}`;
  const tokens = [...new Set([USDG.address, ...extraTokens].map((t) => t.toLowerCase()))].filter((t) => isAddress(t)).slice(0, 12);
  const reads: Read[] = [
    { to, abi: ESCROW_ABI as Abi, fn: "balanceOf", args: [account] },
    ...tokens.map((t) => ({ to, abi: ESCROW_ABI as Abi, fn: "balanceOfToken", args: [account, t] })),
  ];
  const out = await readMany(reads);
  const rows: ClaimRow[] = [];
  const eth = out[0];
  rows.push({
    id: "pons-eth",
    sourceKey: PONS_ESCROW.key,
    sourceName: PONS_ESCROW.name,
    source: to,
    title: "Creator fees in ETH",
    status: typeof eth !== "bigint" ? "unreadable" : eth > 0n ? "claimable" : "empty",
    amount: typeof eth === "bigint" ? eth : 0n,
    token: ETH,
    why:
      typeof eth !== "bigint"
        ? "The escrow did not answer balanceOf just now. Try again in a moment."
        : eth > 0n
          ? "balanceOf(address) on the escrow is above zero: this address is a creator fee recipient with fees waiting."
          : "balanceOf(address) is zero: nothing is credited to this address in ETH.",
    action: typeof eth === "bigint" && eth > 0n ? { label: "claim()", to, data: enc(ESCROW_ABI as Abi, "claim") } : null,
  });
  for (let i = 0; i < tokens.length; i++) {
    const v = out[i + 1];
    if (typeof v !== "bigint" || v === 0n) continue;
    const token = await tokenInfo(tokens[i]);
    rows.push({
      id: `pons-${tokens[i]}`,
      sourceKey: PONS_ESCROW.key,
      sourceName: PONS_ESCROW.name,
      source: to,
      title: `Creator fees in ${token.symbol}`,
      status: "claimable",
      amount: v,
      token,
      why: "balanceOfToken(address, token) is above zero: a pair-token launch credited fees to this address.",
      action: { label: `claimToken(${token.symbol})`, to, data: enc(ESCROW_ABI as Abi, "claimToken", [tokens[i]]) },
    });
  }
  return rows;
}

type LockTuple = { owner: `0x${string}`; token: `0x${string}`; amount: bigint; unlockTime: bigint; withdrawn: boolean };

/** HoodLock locks owned by the address. Withdrawable = unlock time passed and not withdrawn yet. */
export async function readLocks(account: `0x${string}`, now = Math.floor(Date.now() / 1000)): Promise<ClaimRow[]> {
  const to = HOODLOCK.address as `0x${string}`;
  const ids = (await readMany([{ to, abi: LOCKER_ABI as Abi, fn: "locksByOwner", args: [account] }]))[0];
  if (!Array.isArray(ids)) throw new Error("The locker did not answer locksByOwner just now.");
  const list = (ids as bigint[]).slice(-40);
  const locks = await readMany(list.map((id) => ({ to, abi: LOCKER_ABI as Abi, fn: "getLock", args: [id] })));
  const rows: ClaimRow[] = [];
  for (let i = 0; i < list.length; i++) {
    const l = locks[i] as LockTuple | null;
    if (!l) continue;
    const token = await tokenInfo(l.token);
    const unlockAt = Number(l.unlockTime);
    const open = unlockAt <= now;
    const status: ClaimStatus = l.withdrawn ? "claimed" : open ? "claimable" : "locked";
    rows.push({
      id: `lock-${list[i]}`,
      sourceKey: HOODLOCK.key,
      sourceName: HOODLOCK.name,
      source: to,
      title: `Lock #${list[i]} · ${token.symbol}`,
      status,
      amount: l.amount,
      token,
      unlockAt,
      why: l.withdrawn
        ? "This lock was already withdrawn."
        : open
          ? "The unlock time has passed; the lock owner can withdraw it."
          : "Still locked: nothing can be withdrawn before the unlock time.",
      action: status === "claimable" ? { label: `withdraw(${list[i]})`, to, data: enc(LOCKER_ABI as Abi, "withdraw", [list[i]]) } : null,
      link: { label: "HoodLock proof", href: HOODLOCK.proofUrl(list[i]) },
    });
  }
  return rows;
}

export type MerkleCheck = {
  root: Hex | null;
  rootMatches: boolean;
  fileRootMatches: boolean | null;
  claimed: boolean | null;
  token: TokenInfo | null;
  row: ClaimRow;
};

/** A distributor the user names, checked against the user's own proof file. */
export async function readMerkle(distributor: `0x${string}`, claim: Claim): Promise<MerkleCheck> {
  const reads: Read[] = [
    { to: distributor, abi: MERKLE_ABI as Abi, fn: "merkleRoot" },
    { to: distributor, abi: MERKLE_ABI as Abi, fn: "isClaimed", args: [claim.index] },
    { to: distributor, abi: MERKLE_ABI as Abi, fn: "token" },
  ];
  const [root, claimed, tokenAddr] = await readMany(reads);
  const computed = claimRoot(claim);
  const rootHex = typeof root === "string" ? (root as Hex) : null;
  const rootMatches = !!rootHex && rootHex.toLowerCase() === computed.toLowerCase();
  const token = typeof tokenAddr === "string" && isAddress(tokenAddr) && tokenAddr !== zeroAddress ? await tokenInfo(tokenAddr) : null;
  const isClaimed = typeof claimed === "boolean" ? claimed : null;
  const canAct = rootMatches && isClaimed === false && claim.format === "distributor";
  const status: ClaimStatus = !rootHex ? "unreadable" : !rootMatches ? "empty" : isClaimed ? "claimed" : "claimable";
  return {
    root: rootHex,
    rootMatches,
    fileRootMatches: claim.fileRoot ? !!rootHex && claim.fileRoot.toLowerCase() === rootHex.toLowerCase() : null,
    claimed: isClaimed,
    token,
    row: {
      id: `merkle-${distributor}-${claim.index}`,
      sourceKey: "merkle",
      sourceName: "Merkle distributor",
      source: distributor,
      title: `Leaf #${claim.index}${token ? ` · ${token.symbol}` : ""}`,
      status,
      amount: claim.amount,
      token: token ?? { address: null, symbol: "tokens", decimals: 18 },
      why: !rootHex
        ? "This contract does not answer merkleRoot(), so it is not the distributor shape Recla reads."
        : !rootMatches
          ? "Your proof does not lead to the root this contract stores. The file is for another distribution, or it was changed."
          : isClaimed
            ? "isClaimed(index) is true: this leaf was already claimed."
            : claim.format === "distributor"
              ? "The proof leads to the contract's root and isClaimed(index) is false."
              : "The proof leads to the contract's root. This tree format has no standard claim call, so use the simulator with the distributor's own calldata.",
      action: canAct ? { label: "claim(index, account, amount, proof)", to: distributor, data: enc(MERKLE_ABI as Abi, "claim", [claim.index, claim.account, claim.amount, claim.proof]) } : null,
    },
  };
}

/** Vesting wallet (beneficiary = owner()). Reads the ETH side, or one ERC-20 when `token` is given. */
export async function readVesting(source: `0x${string}`, account: `0x${string}`, token?: string): Promise<ClaimRow> {
  const useToken = token && isAddress(token) ? token : null;
  const reads: Read[] = [
    { to: source, abi: VESTING_ABI as Abi, fn: "owner" },
    useToken ? { to: source, abi: VESTING_ABI as Abi, fn: "releasable", args: [useToken] } : { to: source, abi: VESTING_ABI as Abi, fn: "releasable" },
    { to: source, abi: VESTING_ABI as Abi, fn: "end" },
  ];
  const [owner, releasable, end] = await readMany(reads);
  const info = useToken ? await tokenInfo(useToken) : ETH;
  const mine = typeof owner === "string" && owner.toLowerCase() === account.toLowerCase();
  const amt = typeof releasable === "bigint" ? releasable : null;
  const status: ClaimStatus = amt === null || typeof owner !== "string" ? "unreadable" : !mine ? "empty" : amt > 0n ? "claimable" : "locked";
  return {
    id: `vest-${source}-${useToken ?? "eth"}`,
    sourceKey: "vesting",
    sourceName: "Vesting wallet",
    source,
    title: `Vesting · ${info.symbol}`,
    status,
    amount: amt ?? 0n,
    token: info,
    unlockAt: typeof end === "bigint" ? Number(end) : undefined,
    why:
      status === "unreadable"
        ? "This contract does not answer owner() and releasable(), so it is not the vesting shape Recla reads."
        : !mine
          ? `The beneficiary (owner()) is ${owner}, not this address.`
          : amt! > 0n
            ? "releasable() is above zero: this much has vested and was not released yet."
            : "Nothing has vested beyond what was already released.",
    action:
      status === "claimable"
        ? { label: useToken ? `release(${info.symbol})` : "release()", to: source, data: useToken ? enc(VESTING_ABI as Abi, "release", [useToken]) : enc(VESTING_ABI as Abi, "release") }
        : null,
  };
}

/** Refund source: only a refund the contract explicitly exposes through one of the probed views. */
export async function readRefund(source: `0x${string}`, account: `0x${string}`): Promise<ClaimRow> {
  const fns = ["refundOf", "refundable", "refunds"] as const;
  const out = await readMany(fns.map((fn) => ({ to: source, abi: REFUND_ABI as Abi, fn, args: [account] })));
  const k = out.findIndex((v) => typeof v === "bigint");
  const amt = k >= 0 ? (out[k] as bigint) : null;
  const status: ClaimStatus = amt === null ? "unreadable" : amt > 0n ? "claimable" : "empty";
  // Which claim function exists is not knowable from a view; the simulator tries claimRefund() then refund().
  return {
    id: `refund-${source}`,
    sourceKey: "refund",
    sourceName: "Refund source",
    source,
    title: "Refund (ETH, as the contract states it)",
    status,
    amount: amt ?? 0n,
    token: ETH,
    why:
      amt === null
        ? "This contract exposes none of refundOf / refundable / refunds(address). Recla cannot read a refund it does not state."
        : amt > 0n
          ? `${fns[k]}(address) is above zero. The amount is what the contract states; its unit is not checked.`
          : `${fns[k]}(address) is zero for this address.`,
    action: status === "claimable" ? { label: "claimRefund()", to: source, data: enc(REFUND_ABI as Abi, "claimRefund") } : null,
  };
}

/** True when the address holds contract code (checked before any source is trusted). */
export async function hasCode(address: string): Promise<boolean> {
  const code = await rpcCall<string>("eth_getCode", [address, "latest"]);
  return typeof code === "string" && code.length > 2;
}

/** Formats a raw amount with its decimals (trimmed, up to 6 fraction digits). */
export function formatUnits(v: bigint, decimals: number, digits = 6): string {
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, "0").slice(0, digits).replace(/0+$/, "");
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${w}.${frac}` : w;
}

/** A registered fee escrow with the same shape as Pons (balanceOf(address) + claim()). */
export async function readEscrowGeneric(source: `0x${string}`, account: `0x${string}`, label: string): Promise<ClaimRow> {
  const [v] = await readMany([{ to: source, abi: ESCROW_ABI as Abi, fn: "balanceOf", args: [account] }]);
  const amt = typeof v === "bigint" ? v : null;
  return {
    id: `escrow-${source}`,
    sourceKey: "escrow",
    sourceName: label,
    source,
    title: "Escrow balance (ETH)",
    status: amt === null ? "unreadable" : amt > 0n ? "claimable" : "empty",
    amount: amt ?? 0n,
    token: ETH,
    why: amt === null ? "This contract does not answer balanceOf(address) the escrow way." : amt > 0n ? "balanceOf(address) is above zero on this escrow." : "balanceOf(address) is zero for this address.",
    action: amt && amt > 0n ? { label: "claim()", to: source, data: enc(ESCROW_ABI as Abi, "claim") } : null,
  };
}

/** Link to the simulator with everything it needs in the query string. */
export function simulateHref(row: ClaimRow, from: string): string {
  if (!row.action) return "/simulate";
  const q = new URLSearchParams({
    from,
    to: row.action.to,
    data: row.action.data,
    label: `${row.sourceName}: ${row.action.label}`,
    amount: row.amount.toString(),
    symbol: row.token.symbol,
    decimals: String(row.token.decimals),
    ...(row.token.address ? { token: row.token.address } : {}),
  });
  return `/simulate?${q.toString()}`;
}
