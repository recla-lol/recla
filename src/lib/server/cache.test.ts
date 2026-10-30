import { test } from "node:test";
import assert from "node:assert/strict";
import { createCache } from "./cache";
import type { Store } from "./store";

/** Only GET and SET EX exist on this fake, as on a gateway that forbids scripting. */
function fakeStore(fail = false) {
  const data = new Map<string, { v: string; ttl: number }>();
  const ops: string[] = [];
  const no = () => {
    throw new Error("not allowed on this gateway");
  };
  const store = {
    get: async (k: string) => {
      ops.push(`GET ${k}`);
      if (fail) throw new Error("connection refused");
      return data.get(k)?.v ?? null;
    },
    setEx: async (k: string, v: string, ttl: number) => {
      ops.push(`SET ${k} EX ${ttl}`);
      if (fail) throw new Error("connection refused");
      data.set(k, { v, ttl });
    },
    setNx: no, del: no, take: no, delIf: no, incr: no, incrEx: no, incrByEx: no, incrBy: no, mget: no, set: no, pushCapped: no, range: no,
  } as unknown as Store;
  return { store, data, ops };
}

test("a miss runs the job once and stores it in memory and the store, under the cache name", async () => {
  const { store, data, ops } = fakeStore();
  const c = createCache<{ n: number }>("locks", () => store);
  let runs = 0;
  const job = async () => ({ n: ++runs });
  const [a, b] = await Promise.all([c.wrap("k", job, () => 300), c.wrap("k", job, () => 300)]);
  assert.equal(runs, 1, "concurrent misses share one job");
  assert.deepEqual([a.value, b.value], [{ n: 1 }, { n: 1 }]);
  assert.equal(a.cached, false);
  assert.ok(data.has("cache:locks:k"));
  assert.equal(data.get("cache:locks:k")?.ttl, 300);
  assert.ok(ops.every((o) => o.startsWith("GET") || o.startsWith("SET")));
  const again = await c.wrap("k", job, () => 300);
  assert.equal(again.cached, true);
  assert.equal(runs, 1);
});

test("another instance reads the store, and the entry expires with the stored expiry", async () => {
  const { store } = fakeStore();
  let t = 1_000_000;
  const one = createCache<string>("history", () => store, 10, () => t);
  await one.set("a", "hello", 60);
  const two = createCache<string>("history", () => store, 10, () => t);
  assert.deepEqual(await two.get("a"), { value: "hello", from: "store" });
  assert.deepEqual(await two.get("a"), { value: "hello", from: "memory" });
  t += 61_000;
  assert.equal(await two.get("a"), null);
});

test("no store and a failing store both fall back to memory calmly", async () => {
  const none = createCache<number>("source", () => null);
  await none.set("x", 1, 30);
  assert.deepEqual(await none.get("x"), { value: 1, from: "memory" });
  const { store } = fakeStore(true);
  const broken = createCache<number>("source", () => store);
  const r = await broken.wrap("y", async () => 2, () => 30);
  assert.equal(r.value, 2);
  assert.deepEqual(await broken.get("y"), { value: 2, from: "memory" });
});

test("ttl 0 is not stored, a failing job is not cached, and memory stays bounded", async () => {
  const c = createCache<number>("t", () => null, 3);
  await c.wrap("z", async () => 1, () => 0);
  assert.equal(await c.get("z"), null);
  await assert.rejects(c.wrap("e", async () => Promise.reject(new Error("rpc down")), () => 30));
  assert.equal(await c.get("e"), null);
  for (const k of ["a", "b", "c", "d", "e"]) await c.set(k, 1, 30);
  assert.equal(c.size(), 3);
  assert.equal(await c.get("a"), null);
});
