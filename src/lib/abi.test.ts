import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toFunctionSignature, toEventSignature, type AbiFunction, type AbiEvent } from "viem";
import { REGISTRY_ABI } from "./abi";

// The hand-written ABI must describe exactly the compiled ReclaSourceRegistry (src/lib/contracts/artifacts.json).
test("REGISTRY_ABI matches the compiled contract", () => {
  const art = JSON.parse(readFileSync(new URL("./contracts/artifacts.json", import.meta.url), "utf8"));
  const compiled = art.contracts.ReclaSourceRegistry.abi as (AbiFunction | AbiEvent | { type: string; name: string })[];
  const sig = (x: (typeof compiled)[number]) =>
    x.type === "function" ? toFunctionSignature(x as AbiFunction) : x.type === "event" ? toEventSignature(x as AbiEvent) : `${x.type}:${x.name}`;
  const a = new Set(compiled.map(sig));
  const b = new Set((REGISTRY_ABI as unknown as (typeof compiled)[number][]).map(sig));
  assert.deepEqual([...b].sort(), [...a].sort());
});
