import { encodeFunctionData, type Abi } from "viem";
import { CONTRACTS, registryLive } from "@/config/contracts";
import { REGISTRY_ABI } from "@/lib/abi";
import { READ_GAS, read, rpcCall, waitForReceipt } from "@/lib/client";

/* Reads and writes of the ReclaSourceRegistry. Every write is dry-run first so a revert is explained before signing. */

export type Entry = {
  id: number;
  source: `0x${string}`;
  kind: number;
  registrant: `0x${string}`;
  registeredBlock: number;
  registeredAt: number;
  attestCount: number;
  flagCount: number;
  rulesHash: `0x${string}`;
  rulesUrl: string;
  label: string;
};

type Raw = { id: bigint; source: `0x${string}`; kind: number; registrant: `0x${string}`; registeredBlock: bigint; registeredAt: bigint; attestCount: number; flagCount: number; rulesHash: `0x${string}`; rulesUrl: string; label: string };

export const toEntry = (r: Raw): Entry => ({
  id: Number(r.id),
  source: r.source,
  kind: Number(r.kind),
  registrant: r.registrant,
  registeredBlock: Number(r.registeredBlock),
  registeredAt: Number(r.registeredAt),
  attestCount: Number(r.attestCount),
  flagCount: Number(r.flagCount),
  rulesHash: r.rulesHash,
  rulesUrl: r.rulesUrl,
  label: r.label,
});

const abi = REGISTRY_ABI as Abi;
const to = () => CONTRACTS.registry as `0x${string}`;

export async function registryTotals() {
  const [n, a, f] = await Promise.all([
    read<bigint>({ to: to(), abi, fn: "entryCount" }),
    read<bigint>({ to: to(), abi, fn: "attestTotal" }),
    read<bigint>({ to: to(), abi, fn: "flagTotal" }),
  ]);
  return { entries: Number(n), attests: Number(a), flags: Number(f) };
}

/** Newest entries first, up to `max`. */
export async function latestEntries(max = 100): Promise<{ rows: Entry[]; total: number }> {
  const total = Number(await read<bigint>({ to: to(), abi, fn: "entryCount" }));
  if (total === 0) return { rows: [], total };
  const from = Math.max(1, total - max + 1);
  const rows = (await read<readonly Raw[]>({ to: to(), abi, fn: "entries", args: [BigInt(from), BigInt(Math.min(max, 100))] })).map(toEntry);
  return { rows: rows.reverse(), total };
}

export async function getEntry(id: number) {
  return toEntry(await read<Raw>({ to: to(), abi, fn: "getEntry", args: [BigInt(id)] }));
}

export async function entriesForSource(source: string): Promise<Entry[]> {
  const ids = await read<readonly bigint[]>({ to: to(), abi, fn: "entryIdsForSource", args: [source, 0n, 100n] });
  const out: Entry[] = [];
  for (const id of ids) out.push(await getEntry(Number(id)));
  return out;
}

export async function stanceOf(id: number, wallet: string): Promise<{ stance: number; reason: number }> {
  const [s, r] = await read<readonly [number, number]>({ to: to(), abi, fn: "stanceOf", args: [BigInt(id), wallet] });
  return { stance: Number(s), reason: Number(r) };
}

type Send = (tx: { to?: string; data: string }) => Promise<string>;

async function sendChecked(from: string, data: string, send: Send) {
  await rpcCall("eth_call", [{ from, to: to(), data, gas: READ_GAS }, "latest"]);
  const hash = await send({ to: to(), data });
  const r = await waitForReceipt(hash);
  if (!r.ok) throw new Error("The transaction reverted on chain.");
  return { hash, block: r.blockNumber };
}

const enc = (functionName: string, args: unknown[]) => encodeFunctionData({ abi, functionName, args } as never);

export const sendRegister = (from: string, e: { source: string; kind: number; rulesUrl: string; rulesHash: string; label: string }, send: Send) =>
  sendChecked(from, enc("register", [e.source, e.kind, e.rulesUrl, e.rulesHash, e.label]), send);
export const sendAttest = (from: string, id: number, send: Send) => sendChecked(from, enc("attest", [BigInt(id)]), send);
export const sendFlag = (from: string, id: number, reason: number, send: Send) => sendChecked(from, enc("flag", [BigInt(id), reason]), send);

export { registryLive };
