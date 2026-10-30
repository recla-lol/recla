import "server-only";
import type { Hex } from "viem";
import { HOODLOCK } from "@/config/sources";
import { rpc, rpcBatch } from "@/lib/feeds/rpc";
import { READ_GAS } from "@/lib/rpc-client";
import { chunk } from "@/lib/multicall";
import { locksByToken, type TokenLocksAnswer } from "@/lib/locks-by-token";
import { getLogs } from "@/lib/server/history";

/*
 * Server wiring of src/lib/locks-by-token.ts: the shared log reader of Claim History (2 queries at a time, retries)
 * and plain eth_call batches of Multicall3 calls, 8 per request.
 */

const callMany = async (calls: { to: string; data: Hex }[]): Promise<(Hex | null)[]> => {
  const out: (Hex | null)[] = [];
  for (const part of chunk(calls, 8)) {
    const r = await rpcBatch<string>(part.map((c) => ({ method: "eth_call", params: [{ to: c.to, data: c.data, gas: READ_GAS }, "latest"] })));
    out.push(...r.map((v) => (typeof v === "string" && /^0x[0-9a-fA-F]*$/.test(v) ? (v as Hex) : null)));
  }
  return out;
};

export function tokenLocks(token: string): Promise<TokenLocksAnswer> {
  return locksByToken(
    token,
    {
      getLogs,
      callMany,
      latestBlock: async () => Number(BigInt(await rpc<string>("eth_blockNumber", []))),
    },
    { locker: HOODLOCK.address, startBlock: HOODLOCK.deployBlock },
  );
}
