import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, encodeFunctionResult, type Abi, type Hex } from "viem";
import { ERC20_ABI, LOCKER_ABI, MULTICALL3_ABI } from "./abi";
import { TOPICS, padTopic, type GetLogs, type RawLog } from "./history";
import { activeLocks, locksByToken, parseTokenQuery, shareOf, HOODLOCK_LOCKER } from "./locks-by-token";
import { innerCalls } from "./multicall";

const TOKEN = "0x00000000000000000000000000000000000000c1";
const OTHER = "0x00000000000000000000000000000000000000c2";
const OWNER = "0x00000000000000000000000000000000000000a1";
const idTopic = (id: number) => `0x${id.toString(16).padStart(64, "0")}` as Hex;
const lockedLog = (id: number, block: number): RawLog => ({
  address: HOODLOCK_LOCKER,
  topics: [TOPICS.lockLocked, idTopic(id), padTopic(OWNER), padTopic(TOKEN)],
  data: "0x",
  blockNumber: `0x${block.toString(16)}` as Hex,
  transactionHash: `0x${"ab".repeat(32)}` as Hex,
  logIndex: "0x0",
});

/** Locks 1..n: even ids withdrawn, id 5 belongs to another token, id 7 does not answer. Amount = id * 10. */
function chain(n: number) {
  const filters: { topics: unknown[]; fromBlock: number; toBlock: number }[] = [];
  const getLogs: GetLogs = async (f) => {
    filters.push(f);
    // All locks were made in the newest window.
    return f.toBlock === 100_000_000 ? Array.from({ length: n }, (_, i) => lockedLog(i + 1, 99_000_000)).concat([lockedLog(3, 99_000_001)]) : [];
  };
  const callMany = async (calls: { to: string; data: Hex }[]) =>
    calls.map((c) => {
      const inner = innerCalls(c.data)!;
      const results = inner.map((ic) => {
        if (ic.target.toLowerCase() === HOODLOCK_LOCKER.toLowerCase()) {
          const id = Number(decodeFunctionData({ abi: LOCKER_ABI as Abi, data: ic.callData }).args![0] as bigint);
          if (id === 7) return { success: false, returnData: "0x" as Hex };
          return { success: true, returnData: encodeFunctionResult({ abi: LOCKER_ABI as Abi, functionName: "getLock", result: { owner: OWNER, token: id === 5 ? OTHER : TOKEN, amount: BigInt(id * 10), unlockTime: BigInt(id * 1000), withdrawn: id % 2 === 0 } } as never) };
        }
        const fn = decodeFunctionData({ abi: ERC20_ABI as Abi, data: ic.callData }).functionName;
        const result = fn === "symbol" ? "TKN" : fn === "name" ? "Token" : fn === "decimals" ? 6 : 1000n;
        return { success: true, returnData: encodeFunctionResult({ abi: ERC20_ABI as Abi, functionName: fn, result } as never) };
      });
      return encodeFunctionResult({ abi: MULTICALL3_ABI, functionName: "aggregate3", result: results });
    });
  return { filters, deps: { getLogs, callMany, latestBlock: async () => 100_000_000, now: () => 5_500 } };
}

test("locks by token: filtered on topic3, withdrawn and foreign locks dropped, re-read through Multicall3", async () => {
  const { filters, deps } = chain(11);
  const r = await locksByToken(TOKEN, deps, { chunk: 4 });
  assert.deepEqual(filters[0].topics, [TOPICS.lockLocked, null, null, padTopic(TOKEN)]);
  // From the locker's creation block to 100M: ten 10M windows.
  assert.equal(filters.length, 10);
  assert.equal(r.found, 11, "a repeated log of the same id counts once");
  assert.deepEqual(
    r.locks.map((l) => l.id),
    ["11", "9", "3", "1"],
  );
  assert.equal(r.withdrawnCount, 5);
  assert.equal(r.unreadableCount, 2);
  assert.equal(r.symbol, "TKN");
  assert.equal(r.decimals, 6);
  assert.equal(r.totalLocked, String(110 + 90 + 30 + 10));
  assert.equal(r.totalShare, 0.24);
  assert.equal(r.locks[0].shareOfSupply, 0.11);
  assert.equal(r.locks.find((l) => l.id === "3")?.unlocked, true);
  assert.equal(r.locks.find((l) => l.id === "9")?.unlocked, false);
  assert.ok(r.locks.every((l) => l.withdrawn === false));
  assert.equal(r.complete, true);
});

test("locks by token refuses bad tokens before any read", async () => {
  const { filters, deps } = chain(1);
  await assert.rejects(locksByToken("0x123", deps));
  await assert.rejects(locksByToken("0x0000000000000000000000000000000000000000", deps));
  assert.equal(filters.length, 0);
});

test("shares are exact integer fractions and unknown supply gives null", () => {
  assert.equal(shareOf(1n, 3n), 0.33333333);
  assert.equal(shareOf(5n, 0n), null);
  assert.equal(shareOf(5n, null), null);
  const { locks, unreadable } = activeLocks([1n, 2n], [null, { owner: OWNER, token: TOKEN, amount: 4n, unlockTime: 1n, withdrawn: false }], TOKEN, null, 0);
  assert.equal(unreadable, 1);
  assert.equal(locks[0].shareOfSupply, null);
});

test("the query accepts exactly one token address and nothing else", () => {
  const q = (s: string) => parseTokenQuery(new URL(`https://recla.lol/api/locks${s}`));
  assert.deepEqual(q(`?token=${TOKEN.toUpperCase().replace("0X", "0x")}`), { token: TOKEN });
  assert.ok("error" in q(""));
  assert.ok("error" in q("?token=0x12"));
  assert.ok("error" in q(`?token=${TOKEN}&token=${OTHER}`));
  assert.ok("error" in q(`?token=${TOKEN}&x=1`));
  assert.ok("error" in q("?token=0x0000000000000000000000000000000000000000"));
  assert.ok("error" in q(`?token=${TOKEN}%20`));
});
