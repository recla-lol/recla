import { test } from "node:test";
import assert from "node:assert/strict";
import { readLocks } from "./claims";
import type { Read } from "./client";

const OWNER = "0x00000000000000000000000000000000000000a1";
const TOKEN = "0x00000000000000000000000000000000000000c1";

test("readLocks reads every lock of an owner, not only the newest 40, and sorts withdrawable first", async () => {
  const n = 135;
  const seen: number[] = [];
  const reader = async (reads: Read[]) => {
    seen.push(reads.length);
    return reads.map((r) => {
      if (r.fn === "locksByOwner") return Array.from({ length: n }, (_, i) => BigInt(i + 1));
      const id = Number(r.args![0] as bigint);
      // ids 1..50 withdrawn, 51..100 unlocked, 101..135 still locked (unlock = id); id 77 unreadable.
      if (id === 77) return null;
      return { owner: OWNER, token: TOKEN, amount: BigInt(id), unlockTime: BigInt(id <= 100 ? 10 : 1_000 + id), withdrawn: id <= 50 };
    });
  };
  const rows = await readLocks(OWNER, 500, { reader, tokens: async () => new Map([[TOKEN, { address: TOKEN, symbol: "TKN", decimals: 18 }]]) });
  assert.equal(rows.length, n);
  assert.deepEqual(seen, [1, n]);
  assert.equal(rows[0].status, "claimable");
  assert.equal(rows[0].id, "lock-100", "newest withdrawable lock first");
  assert.equal(rows.filter((r) => r.status === "claimable").length, 49);
  const locked = rows.filter((r) => r.status === "locked");
  assert.equal(locked.length, 35);
  assert.equal(locked[0].id, "lock-101", "soonest unlock first");
  assert.equal(rows.filter((r) => r.status === "unreadable").length, 1);
  assert.equal(rows[rows.length - 1].status, "claimed");
  assert.ok(rows.find((r) => r.id === "lock-60")?.action?.label === "withdraw(60)");
  assert.equal(rows.find((r) => r.id === "lock-60")?.token.symbol, "TKN");
});

test("readLocks says so when the locker does not answer", async () => {
  await assert.rejects(readLocks(OWNER, 0, { reader: async (reads) => reads.map(() => null) }));
});
