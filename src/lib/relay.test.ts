import { test } from "node:test";
import assert from "node:assert/strict";
import { USDG } from "@/config/brand";
import { checkBatch, runRelay } from "./relay";

const call = (to: string, data = "0x") => ({ method: "eth_call", params: [{ to, data }, "latest"] });

test("reads of known contracts are priced", () => {
  const out = checkBatch([call(USDG.address, "0x18160ddd")]);
  assert.ok("units" in out && out.units === 2);
});

test("unknown targets without an explicit low gas, signed transactions and log scans are refused", () => {
  assert.ok("error" in checkBatch([call("0x000000000000000000000000000000000000dead")]));
  const probe = (gas: string, data = "0x18160ddd") => ({ method: "eth_call", params: [{ to: "0x000000000000000000000000000000000000dead", data, gas }, "latest"] });
  const ok = checkBatch([probe("0x16e360")]);
  assert.ok("units" in ok && ok.probes === 1 && ok.units === 6);
  assert.ok("error" in checkBatch([probe("0x16e361")]));
  assert.ok("error" in checkBatch([probe("0x16e360", `0x${"ab".repeat(5000)}`)]));
  assert.ok("error" in checkBatch([{ method: "eth_sendRawTransaction", params: ["0x02"] }]));
  assert.ok("error" in checkBatch([{ method: "eth_getLogs", params: [{ address: USDG.address, fromBlock: "0x1", toBlock: "latest" }] }]));
  assert.ok("error" in checkBatch([{ method: "eth_getLogs", params: [{ address: USDG.address, fromBlock: "0x1", toBlock: "0x100000" }] }]));
});

test("a refused budget never reaches the RPC", async () => {
  let reached = false;
  const out = await runRelay(call(USDG.address, "0x18160ddd"), {
    charge: async () => "slow down",
    chargeProbe: async () => null,
    one: async () => {
      reached = true;
      return { result: "0x" };
    },
    many: async () => [],
  });
  assert.equal(out.status, 429);
  assert.equal(reached, false);
});

test("an unknown address is charged, then refused without reaching the RPC", async () => {
  let charged = 0;
  let reached = false;
  const out = await runRelay(call("0x00000000000000000000000000000000000a11ce", "0x18160ddd"), {
    charge: async (u) => {
      charged += u;
      return null;
    },
    chargeProbe: async () => null,
    one: async () => {
      reached = true;
      return { result: "0x" };
    },
    many: async () => [],
  });
  assert.equal(out.status, 400);
  assert.ok(charged > 0);
  assert.equal(reached, false);
});

test("eth_estimateGas is relayed only for contracts the site reads", () => {
  const est = (tx: Record<string, unknown>) => ({ method: "eth_estimateGas", params: [tx] });
  const known = checkBatch([est({ to: USDG.address, data: "0x18160ddd" })]);
  assert.ok("units" in known && known.units === 3);
  assert.ok("error" in checkBatch([est({ to: "0x000000000000000000000000000000000000dead", data: "0x" })]));
  assert.ok("units" in checkBatch([est({ to: "0x000000000000000000000000000000000000dead", data: "0x", gas: "0x100000" })]));
  assert.ok("error" in checkBatch([est({ data: "0x6080" })]));
});

test("inherited object names are not methods", () => {
  for (const method of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"]) {
    assert.ok("error" in checkBatch([{ method, params: [] }]), method);
  }
});

test("a probe spends the site-wide probe budget and stops when it is empty", async () => {
  const p = { method: "eth_call", params: [{ to: "0x00000000000000000000000000000000000a11ce", data: "0x18160ddd", gas: "0x100000" }, "latest"] };
  let reached = false;
  const out = await runRelay(p, { charge: async () => null, chargeProbe: async () => "busy", one: async () => { reached = true; return { result: "0x" }; }, many: async () => [] });
  assert.equal(out.status, 429);
  assert.equal(reached, false);
  let spent = 0;
  const ok = await runRelay(p, { charge: async () => null, chargeProbe: async (u) => { spent += u; return null; }, one: async () => ({ result: "0x01" }), many: async () => [] });
  assert.equal(ok.status, 200);
  assert.equal(spent, 4);
});
