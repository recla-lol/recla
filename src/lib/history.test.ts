import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters, type Hex } from "viem";
import { MAX_EVENTS, TOPICS, filterShapeOk, padTopic, toEvent, walkLogs, windows, type GetLogs, type RawLog } from "./history";

const ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";
const ME = "0x00000000000000000000000000000000000000a1";

test("windows walk back from the newest block and stop at the start", () => {
  assert.deepEqual(windows(5, 25, 10), [
    [16, 25],
    [6, 15],
    [5, 5],
  ]);
  assert.equal(windows(0, 100_000_000).length, 11);
  assert.deepEqual(windows(10, 5), []);
});

test("only the server's own filter shapes pass", () => {
  assert.ok(filterShapeOk({ address: ESCROW, topics: [TOPICS.ponsClaimed, padTopic(ME)] }));
  assert.ok(!filterShapeOk({ address: ESCROW, topics: [[TOPICS.ponsClaimed, TOPICS.ponsClaimedToken], padTopic(ME)] }));
  assert.ok(!filterShapeOk({ address: ESCROW, topics: [] }));
  assert.ok(!filterShapeOk({ address: ESCROW, topics: [("0x" + "11".repeat(32)) as Hex] }));
  assert.ok(!filterShapeOk({ address: "0x12", topics: [TOPICS.ponsClaimed] }));
  assert.ok(!filterShapeOk({ address: ESCROW, topics: [TOPICS.ponsClaimed, ("0x" + "ff".repeat(32)) as Hex] }));
});

const log = (block: number, topics: Hex[], data: Hex): RawLog => ({ address: ESCROW, topics, data, blockNumber: `0x${block.toString(16)}` as Hex, transactionHash: `0x${"ab".repeat(32)}` as Hex, logIndex: "0x0" });

test("a window over the node's limit is split and the newest half comes first", async () => {
  const calls: [number, number][] = [];
  const get: GetLogs = async (f) => {
    calls.push([f.fromBlock, f.toBlock]);
    if (f.toBlock - f.fromBlock > 50) throw new Error("logs matched by query exceeds limit of 10000");
    return [log(f.toBlock, [TOPICS.ponsClaimed, padTopic(ME)], encodeAbiParameters([{ type: "uint256" }], [5n]))];
  };
  const r = await walkLogs(get, { address: ESCROW, topics: [TOPICS.ponsClaimed, padTopic(ME)] }, 0, 199);
  assert.ok(r.logs.length >= 4);
  assert.equal(Number(BigInt(r.logs[0].blockNumber)), 199);
  assert.ok(calls.length > 1);
});

test("other RPC errors are not swallowed", async () => {
  const get: GetLogs = async () => {
    throw new Error("connection reset");
  };
  await assert.rejects(walkLogs(get, { address: ESCROW, topics: [TOPICS.ponsClaimed] }, 0, 10));
});

test("refused shapes never reach the RPC", async () => {
  let reached = false;
  const get: GetLogs = async () => {
    reached = true;
    return [];
  };
  await assert.rejects(walkLogs(get, { address: ESCROW, topics: [] }, 0, 10));
  assert.equal(reached, false);
});

test("the walk stops at MAX_EVENTS and says it is incomplete", async () => {
  const get: GetLogs = async (f) => Array.from({ length: 150 }, () => log(f.toBlock, [TOPICS.ponsClaimed, padTopic(ME)], encodeAbiParameters([{ type: "uint256" }], [1n])));
  const r = await walkLogs(get, { address: ESCROW, topics: [TOPICS.ponsClaimed, padTopic(ME)] }, 0, 50_000_000);
  assert.equal(r.logs.length, MAX_EVENTS);
  assert.equal(r.complete, false);
});

test("logs decode into rows; Merkle claims of other accounts are dropped", () => {
  const e = toEvent(log(7, [TOPICS.ponsClaimed, padTopic(ME)], encodeAbiParameters([{ type: "uint256" }], [123n])), "pons");
  assert.equal(e?.label, "Claimed");
  assert.equal(e?.amount, "123");
  const m = (acct: string) => log(9, [TOPICS.merkleClaimed], encodeAbiParameters([{ type: "uint256" }, { type: "address" }, { type: "uint256" }], [3n, acct as Hex, 50n]));
  assert.equal(toEvent(m(ME), "merkle", ME)?.ref, "leaf 3");
  assert.equal(toEvent(m("0x00000000000000000000000000000000000000b2"), "merkle", ME), null);
  assert.equal(toEvent(log(1, [("0x" + "11".repeat(32)) as Hex], "0x"), "x"), null);
});
