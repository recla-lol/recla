import type { Store } from "./store";

/*
 * Two-level answer cache for API routes: L1 is this instance's memory (bounded), L2 the shared store (Redis via
 * src/lib/server/store.ts, every key under the project prefix "recla:"). Only plain GET and SET EX are used, so a
 * gateway that forbids scripting (EVAL) is fine. Without a store, or while the store fails, the cache keeps working
 * from memory alone: a store error is never an error for the visitor.
 *
 * Values are stored as JSON with their expiry, so an entry read from the store expires in L1 at the same moment.
 * The same key asked twice at once runs its job once.
 */

type Entry<T> = { exp: number; value: T };

export type AnswerCache<T> = {
  /** The cached value and where it came from, or null. */
  get(key: string): Promise<{ value: T; from: "memory" | "store" } | null>;
  set(key: string, value: T, ttlSec: number): Promise<void>;
  /**
   * Cached value, or the job's answer stored for ttl(value) seconds (0 = do not store). Concurrent misses of one
   * key share one job.
   */
  wrap(key: string, job: () => Promise<T>, ttl: (value: T) => number): Promise<{ value: T; cached: boolean }>;
  /** L1 size (tests). */
  size(): number;
};

export function createCache<T>(name: string, store: () => Store | null, maxEntries = 2_000, now: () => number = Date.now): AnswerCache<T> {
  const mem = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();
  const storeKey = (key: string) => `cache:${name}:${key}`;

  const remember = (key: string, e: Entry<T>) => {
    mem.delete(key);
    while (mem.size >= maxEntries) mem.delete(mem.keys().next().value as string);
    mem.set(key, e);
  };

  async function get(key: string) {
    const hit = mem.get(key);
    if (hit) {
      if (hit.exp > now()) return { value: hit.value, from: "memory" as const };
      mem.delete(key);
    }
    const s = store();
    if (!s) return null;
    try {
      const raw = await s.get(storeKey(key));
      if (!raw) return null;
      const e = JSON.parse(raw) as Entry<T>;
      if (typeof e?.exp !== "number" || e.exp <= now()) return null;
      remember(key, e);
      return { value: e.value, from: "store" as const };
    } catch {
      return null;
    }
  }

  async function set(key: string, value: T, ttlSec: number) {
    if (!(ttlSec > 0)) return;
    const e: Entry<T> = { exp: now() + ttlSec * 1000, value };
    remember(key, e);
    const s = store();
    if (!s) return;
    try {
      await s.setEx(storeKey(key), JSON.stringify(e), Math.ceil(ttlSec));
    } catch {
      // Memory still holds it; the next instance reads the chain again.
    }
  }

  async function wrap(key: string, job: () => Promise<T>, ttl: (value: T) => number) {
    const hit = await get(key);
    if (hit) return { value: hit.value, cached: true };
    let p = inflight.get(key);
    if (!p) {
      p = (async () => {
        const value = await job();
        await set(key, value, ttl(value));
        return value;
      })().finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return { value: await p, cached: false };
  }

  return { get, set, wrap, size: () => mem.size };
}
