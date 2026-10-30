import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, encodeFunctionResult, type Abi, type Hex } from "viem";
import { ERC20_ABI, LOCKER_ABI, MULTICALL3_ABI } from "./abi";
import { MULTICALL3, chunk, decodeAggregate3, encodeAggregate3, innerCalls, multicallRead, type Read } from "./multicall";
import { createRpcClient } from "./rpc-client";

const TOKEN = "0x00000000000000000000000000000000000000c1";
const LOCKER = "0xD0f7d8c6e9f6D80c297bEbe4F7fD1B9C8125C32F";

/** A fake Multicall3: answers getLock(id) with a lock whose amount is the id, totalSupply with 1000; odd failures. */
export function fakeAggregate(data: Hex, fail: (target: string, callData: Hex) => boolean = () => false): Hex {
  const calls = innerCalls(data)!;
  const results = calls.map((c) => {
    if (fail(c.target, c.callData)) return { success: false, returnData: "0x" as Hex };
    if (c.target.toLowerCase() === LOCKER.toLowerCase()) {
      const d = decodeFunctionData({ abi: LOCKER_ABI as Abi, data: c.callData });
      const id = d.args![0] as bigint;
      return { success: true, returnData: encodeFunctionResult({ abi: LOCKER_ABI as Abi, functionName: "getLock", result: { owner: TOKEN, token: TOKEN, amount: id, unlockTime: 100n, withdrawn: false } } as never) };
    }
    return { success: true, returnData: encodeFunctionResult({ abi: ERC20_ABI as Abi, functionName: "totalSupply", result: 1000n } as never) };
  });
  return encodeFunctionResult({ abi: MULTICALL3_ABI, functionName: "aggregate3", result: results });
}

const getLock = (id: bigint): Read => ({ to: LOCKER, abi: LOCKER_ABI as Abi, fn: "getLock", args: [id] });

test("chunk splits lists and refuses a zero size", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
  assert.throws(() => chunk([1], 0));
});

test("aggregate3 calldata round-trips and a failed inner read is null", () => {
  const reads = [getLock(7n), { to: TOKEN, abi: ERC20_ABI as Abi, fn: "totalSupply" }, getLock(9n)];
  const data = encodeAggregate3(reads);
  assert.equal(innerCalls(data)?.length, 3);
  const out = decodeAggregate3(reads, fakeAggregate(data, (_t, cd) => cd.includes("9".padStart(64, "0"))));
  assert.equal((out[0] as { amount: bigint }).amount, 7n);
  assert.equal(out[1], 1000n);
  assert.equal(out[2], null);
  assert.deepEqual(decodeAggregate3(reads, "0x"), [null, null, null]);
  assert.equal(innerCalls("0x12345678"), null);
});

test("multicallRead chunks the reads and falls back for a chunk Multicall3 cannot answer", async () => {
  const reads = Array.from({ length: 95 }, (_, i) => getLock(BigInt(i + 1)));
  const sizes: number[] = [];
  let fallbacks = 0;
  const out = await multicallRead(
    async (calls) =>
      calls.map((c, i) => {
        assert.equal(c.to, MULTICALL3);
        sizes.push(innerCalls(c.data)!.length);
        return i === 1 ? null : fakeAggregate(c.data);
      }),
    reads,
    {
      fallback: async (rs) => {
        fallbacks += rs.length;
        return rs.map(() => "fallback");
      },
    },
  );
  assert.deepEqual(sizes, [40, 40, 15]);
  assert.equal(fallbacks, 40);
  assert.equal(out.length, 95);
  assert.equal((out[0] as { amount: bigint }).amount, 1n);
  assert.equal(out[40], "fallback");
  assert.equal((out[94] as { amount: bigint }).amount, 95n);
});

test("the rpc client keeps every batch request under its size limit and reads all chunks", async () => {
  const bodies: number[] = [];
  const fakeFetch = (async (_url: string, init: { body: string }) => {
    bodies.push(init.body.length);
    const calls = JSON.parse(init.body) as { id: number; params: [{ data: Hex }] }[];
    return new Response(JSON.stringify(calls.map((c) => ({ jsonrpc: "2.0", id: c.id, result: fakeAggregate(c.params[0].data) }))));
  }) as unknown as typeof fetch;
  const client = createRpcClient({ endpoints: ["http://rpc.test"], maxBatchChars: 28_000, fetch: fakeFetch });
  const reads = Array.from({ length: 300 }, (_, i) => getLock(BigInt(i)));
  const out = await client.readMulticall(reads);
  assert.equal(out.length, 300);
  assert.ok(out.every((v, i) => (v as { amount: bigint }).amount === BigInt(i)));
  assert.ok(bodies.length >= 4, `expected several requests, got ${bodies.length}`);
  assert.ok(bodies.every((b) => b <= 28_000 + 200), `a request body was ${Math.max(...bodies)} characters`);
});
