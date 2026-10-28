import { decodeFunctionData, parseAbi, toFunctionSelector, type Abi, type Hex } from "viem";
import { HOODLOCK, PONS_ESCROW } from "@/config/sources";
import { ESCROW_ABI, LOCKER_ABI, MERKLE_ABI, REFUND_ABI, VESTING_ABI } from "@/lib/abi";

/*
 * Signing gate for the simulator. Anyone can paste calldata or open a link with calldata in it, so the "Sign in my
 * wallet" button is offered only when:
 *   1. the 4-byte selector is one of the claim calls Recla's own adapters build (claim, claimToken, withdraw, release,
 *      release(token), claimRefund, the Merkle claim), and
 *   2. the target is a built-in source or a source registered in the ReclaSourceRegistry (checked by the caller).
 * Approvals, transfers, permits, multicall/execute-style batches and every unknown selector are refused outright:
 * they can be simulated, never signed from this site.
 */

/** The only calls the site will put in front of a wallet. */
const CLAIM_SIGS = [
  "claim()",
  "claimToken(address)",
  "withdraw(uint256)",
  "release()",
  "release(address)",
  "claimRefund()",
  "claim(uint256,address,uint256,bytes32[])",
] as const;

/** Calls that move or hand over the user's assets, or wrap other calls. Named so the refusal says why. */
const BLOCKED_SIGS = [
  "approve(address,uint256)",
  "increaseAllowance(address,uint256)",
  "decreaseAllowance(address,uint256)",
  "setApprovalForAll(address,bool)",
  "transfer(address,uint256)",
  "transferFrom(address,address,uint256)",
  "safeTransferFrom(address,address,uint256)",
  "safeTransferFrom(address,address,uint256,bytes)",
  "safeTransferFrom(address,address,uint256,uint256,bytes)",
  "safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)",
  "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
  "permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)",
  "permit(address,((address,uint160,uint48,uint48),address,uint256),bytes)",
  "permitTransferFrom(((address,uint256),uint256,uint256),(address,uint256),address,bytes)",
  "multicall(bytes[])",
  "multicall(uint256,bytes[])",
  "multicall(bytes32,bytes[])",
  "aggregate((address,bytes)[])",
  "aggregate3((address,bool,bytes)[])",
  "tryAggregate(bool,(address,bytes)[])",
  "execute(address,uint256,bytes)",
  "execute(bytes,bytes[],uint256)",
  "execute(bytes,bytes[])",
  "executeBatch(address[],uint256[],bytes[])",
  "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)",
  "delegate(address)",
  "upgradeTo(address)",
  "upgradeToAndCall(address,bytes)",
] as const;

const sel = (sig: string) => toFunctionSelector(`function ${sig}`).toLowerCase();
export const CLAIM_SELECTORS = new Map<string, string>(CLAIM_SIGS.map((s) => [sel(s), s]));
export const BLOCKED_SELECTORS = new Map<string, string>(BLOCKED_SIGS.map((s) => [sel(s), s]));

export type SelectorVerdict = { kind: "claim" | "blocked" | "unknown" | "invalid"; signature: string | null; selector: string | null; reason: string | null };

/** What kind of call this calldata is. Only "claim" may ever be signed. */
export function selectorVerdict(data: string): SelectorVerdict {
  if (typeof data !== "string" || !/^0x[0-9a-fA-F]{8}([0-9a-fA-F]{2})*$/.test(data)) return { kind: "invalid", signature: null, selector: null, reason: "Calldata must be hex with a 4-byte selector." };
  const s = data.slice(0, 10).toLowerCase();
  const claim = CLAIM_SELECTORS.get(s);
  if (claim) return { kind: "claim", signature: claim, selector: s, reason: null };
  const bad = BLOCKED_SELECTORS.get(s);
  if (bad) return { kind: "blocked", signature: bad, selector: s, reason: `This is ${bad}, not a claim. It can give away or move your assets, so this site will never ask your wallet to sign it.` };
  return { kind: "unknown", signature: null, selector: s, reason: `Selector ${s} is not one of the claim calls Recla builds, so this site will not ask your wallet to sign it. You can still simulate it.` };
}

/** True for the two built-in sources (no registry lookup needed). */
export const isBuiltInSource = (to: string) => [PONS_ESCROW.address, HOODLOCK.address].some((a) => a.toLowerCase() === to.toLowerCase());

const DECODE_ABIS: Abi[] = [ESCROW_ABI as Abi, LOCKER_ABI as Abi, VESTING_ABI as Abi, REFUND_ABI as Abi, MERKLE_ABI as Abi, parseAbi(BLOCKED_SIGS.filter((s) => !s.includes("((")).map((s) => `function ${s}`))];

/** Human-readable form of the call ("approve(0xabc…, 1157…)") for display; null when no known ABI decodes it. */
export function describeCall(data: string): string | null {
  for (const abi of DECODE_ABIS) {
    try {
      const d = decodeFunctionData({ abi, data: data as Hex });
      const args = (d.args ?? []).map((a) => (Array.isArray(a) ? `[${a.length} items]` : String(a)));
      return `${d.functionName}(${args.join(", ")})`;
    } catch {
      // try the next ABI
    }
  }
  return null;
}

export type SignGate = { ok: true; signature: string } | { ok: false; reason: string };

/** Final decision: a known claim selector AND a target that is built in or registered. */
export function signGate(data: string, to: string, registered: boolean): SignGate {
  const v = selectorVerdict(data);
  if (v.kind !== "claim") return { ok: false, reason: v.reason ?? "Not a claim call." };
  if (!isBuiltInSource(to) && !registered)
    return { ok: false, reason: "This contract is not a built-in source and is not registered in the Recla source registry, so this site will not ask your wallet to sign a call to it. Register it first, or claim on the source's own site after checking it." };
  return { ok: true, signature: v.signature! };
}
