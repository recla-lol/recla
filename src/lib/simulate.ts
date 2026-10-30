import { decodeErrorResult, decodeFunctionResult, type Abi, type Hex } from "viem";
import { ALL_ERRORS, ERC20_ABI, ERROR_WORDS } from "./abi";
import { ChainError, READ_GAS, type RpcClient } from "./rpc-client";

/*
 * Self-contained module: depends only on viem, ./abi and ./rpc-client (no app, config or React imports). The
 * simulator takes its RPC client as an argument: createSimulator(createRpcClient({ endpoints: [...] })).
 *
 * Claim Simulator: runs the exact claim transaction as an eth_call from the claimer's own address against the latest
 * block, so the contract executes it for real without anything being sent or signed. The answer is "would succeed"
 * (with what it returns) or "would revert" (with the reason in plain words). Recla adds the balance the user holds
 * now and what the source says should arrive. Nothing is sent until the user signs in their own wallet.
 */

export type SimInput = { from: `0x${string}`; to: `0x${string}`; data: Hex; value?: bigint };

export type SimResult = {
  ok: boolean;
  /** Raw return data on success. */
  returned: Hex | null;
  /** Plain-words revert reason on failure. */
  reason: string | null;
  /** 4-byte selector of a custom error this site does not know. */
  selector: string | null;
  gas: number | null;
  hasCode: boolean;
  at: number;
  blockNumber: number | null;
};

const STD_ERRORS = [
  { type: "error", name: "Error", inputs: [{ name: "message", type: "string" }] },
  { type: "error", name: "Panic", inputs: [{ name: "code", type: "uint256" }] },
] as const;

/** Plain words for revert data: Error(string), Panic(code), a known custom error, or the bare selector. */
export function revertWords(data: string | null | undefined, fallback = "The call reverted without a reason."): { reason: string; selector: string | null } {
  if (!data || data === "0x" || data.length < 10) return { reason: fallback, selector: null };
  try {
    const d = decodeErrorResult({ abi: [...STD_ERRORS, ...ALL_ERRORS] as Abi, data: data as Hex });
    if (d.errorName === "Error") return { reason: `Reverted: "${String(d.args?.[0]).slice(0, 200)}"`, selector: null };
    if (d.errorName === "Panic") return { reason: `Reverted with panic code 0x${(d.args?.[0] as bigint).toString(16)} (an arithmetic or assertion failure inside the contract).`, selector: null };
    return { reason: ERROR_WORDS[d.errorName] ?? `Reverted with ${d.errorName}.`, selector: null };
  } catch {
    return { reason: `Reverted with a custom error this site does not know (selector ${data.slice(0, 10)}). Read the source's verified code for its meaning.`, selector: data.slice(0, 10) };
  }
}

const hex = (v: bigint) => `0x${v.toString(16)}`;

/** The token a claim pays: an ERC-20 address, or null for the chain's native coin. */
export type PaidToken = { address: string | null };

/** Simulator bound to one RPC client. */
export function createSimulator(client: Pick<RpcClient, "call" | "batchLoose">) {
  const rpcCall = client.call;
  const rpcBatchLoose = client.batchLoose;

  async function simulate(input: SimInput): Promise<SimResult> {
    const tx = { from: input.from, to: input.to, data: input.data, gas: READ_GAS, ...(input.value ? { value: hex(input.value) } : {}) };
    const [code, head] = await rpcBatchLoose([
      { method: "eth_getCode", params: [input.to, "latest"] },
      { method: "eth_blockNumber", params: [] },
    ]).catch(() => [null, null]);
    const hasCode = typeof code === "string" && code.length > 2;
    const blockNumber = typeof head === "string" ? Number(BigInt(head)) : null;
    const base = { hasCode, at: Date.now(), blockNumber };
    if (!hasCode) return { ok: false, returned: null, reason: "There is no contract at this address, so there is nothing to claim from.", selector: null, gas: null, ...base };
    try {
      const returned = await rpcCall<Hex>("eth_call", [tx, "latest"]);
      let gas: number | null = null;
      try {
        gas = Number(BigInt(await rpcCall<string>("eth_estimateGas", [tx])));
      } catch {
        gas = null;
      }
      return { ok: true, returned, reason: null, selector: null, gas, ...base };
    } catch (e) {
      const data = e instanceof ChainError ? e.data : null;
      const msg = e instanceof Error ? e.message : "";
      if (!data && !/revert/i.test(msg))
        return { ok: false, returned: null, reason: `The chain could not run the simulation right now (${msg.slice(0, 120) || "no answer"}). Nothing was sent.`, selector: null, gas: null, ...base };
      const w = revertWords(data, /out of gas/i.test(msg) ? "The call ran out of the simulation's gas limit (1,500,000)." : "The call reverted without a reason.");
      return { ok: false, returned: null, reason: w.reason, selector: w.selector, gas: null, ...base };
    }
  }

  /** The claimer's balance of the token (or ETH) the claim pays, read now. */
  async function balanceNow(account: `0x${string}`, token: PaidToken): Promise<bigint | null> {
    try {
      if (!token.address) return BigInt(await rpcCall<string>("eth_getBalance", [account, "latest"]));
      const raw = await rpcCall<Hex>("eth_call", [{ to: token.address, data: `0x70a08231${account.slice(2).toLowerCase().padStart(64, "0")}`, gas: READ_GAS }, "latest"]);
      return decodeFunctionResult({ abi: ERC20_ABI, functionName: "balanceOf", data: raw }) as bigint;
    } catch {
      return null;
    }
  }

  return { simulate, balanceNow };
}

/** Decodes a uint256 return value (claim() on the escrow returns the amount paid). */
export function returnedAmount(returned: Hex | null): bigint | null {
  if (!returned || returned.length !== 66) return null;
  return BigInt(returned);
}

/** Basic sanity of user-pasted calldata. */
export function calldataProblem(data: string): string | null {
  if (!/^0x[0-9a-fA-F]*$/.test(data)) return "Calldata must be hex starting with 0x.";
  if (data.length < 10) return "Calldata needs at least a 4-byte function selector.";
  if ((data.length - 2) % 2 !== 0) return "Calldata has an odd number of hex digits.";
  if (data.length > 8_000) return "Calldata is longer than 3,999 bytes.";
  return null;
}
