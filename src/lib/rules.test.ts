import { test } from "node:test";
import assert from "node:assert/strict";
import { keccak256, toBytes } from "viem";
import { RuleError, labelProblem, practiceRegister, practiceRespond, rulesHashOf, urlProblem } from "./rules";
import { revertWords, calldataProblem, returnedAmount } from "./simulate";

const SRC = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";
const A = "0x00000000000000000000000000000000000000a1";
const B = "0x00000000000000000000000000000000000000b2";
const H = keccak256(toBytes("rules"));
const base = { source: SRC, kind: 4, rulesUrl: "https://example.org/rules", rulesHash: H, label: "Escrow", sig: "0x" };

test("url rules mirror the contract", () => {
  assert.equal(urlProblem("https://a.org"), null);
  assert.ok(urlProblem("http://a.org"));
  assert.ok(urlProblem("https://"));
  assert.ok(urlProblem("https://a b"));
  assert.ok(urlProblem("https://" + "a".repeat(193)));
  assert.equal(urlProblem("https://" + "a".repeat(192)), null);
  assert.ok(urlProblem("https://é.org"));
});

test("label rules mirror the contract", () => {
  assert.equal(labelProblem("Example drop"), null);
  assert.ok(labelProblem(""));
  assert.ok(labelProblem(" x"));
  assert.ok(labelProblem("x "));
  assert.ok(labelProblem("a".repeat(49)));
  assert.equal(labelProblem("a".repeat(48)), null);
  assert.ok(labelProblem("tab\t"));
});

test("rules hash: text is hashed as published, a pasted hash is kept", () => {
  assert.equal(rulesHashOf("rules"), H);
  assert.equal(rulesHashOf(H.toUpperCase().replace("0X", "0x")), H);
  assert.equal(rulesHashOf(""), null);
});

test("practice registry: one entry per wallet per source, no self-response, one response per wallet", () => {
  let st = practiceRegister({ entries: [] }, A, base);
  assert.equal(st.entries[0].id, 1);
  assert.throws(() => practiceRegister(st, A, base), RuleError);
  st = practiceRegister(st, B, base);
  assert.equal(st.entries.length, 2);
  assert.throws(() => practiceRespond(st, A, 1, 1), /cannot attest/);
  st = practiceRespond(st, B, 1, 1);
  assert.equal(st.entries[0].attestCount, 1);
  assert.throws(() => practiceRespond(st, B, 1, 2, 1), /already/);
  assert.throws(() => practiceRespond(st, A, 2, 2, 0), /reason/);
  st = practiceRespond(st, A, 2, 2, 4);
  assert.equal(st.entries[1].flagCount, 1);
  assert.throws(() => practiceRespond(st, A, 9, 1), /no entry/);
});

test("practice registry refuses what the contract refuses", () => {
  assert.throws(() => practiceRegister({ entries: [] }, A, { ...base, kind: 6 }), /kinds/);
  assert.throws(() => practiceRegister({ entries: [] }, A, { ...base, rulesUrl: "http://x" }), /https/);
  assert.throws(() => practiceRegister({ entries: [] }, A, { ...base, rulesHash: "0x" + "0".repeat(64) }), /rules/);
  assert.throws(() => practiceRegister({ entries: [] }, A, { ...base, source: "0x12" }), /address/);
});

test("revert reasons in plain words", () => {
  // Error("Nothing to claim")
  const err = "0x08c379a0" + "0".repeat(62) + "20" + "0".repeat(62) + "10" + Buffer.from("Nothing to claim").toString("hex").padEnd(64, "0");
  assert.match(revertWords(err).reason, /Nothing to claim/);
  // NoBalance() on the Pons escrow (selector from its verified ABI)
  assert.match(revertWords("0xc2caa2a6").reason, /holds no balance/);
  // Panic(0x11)
  assert.match(revertWords("0x4e487b71" + "0".repeat(62) + "11").reason, /panic code 0x11/);
  const unknown = revertWords("0xdeadbeef");
  assert.equal(unknown.selector, "0xdeadbeef");
  assert.match(revertWords(null).reason, /without a reason/);
});

test("calldata checks and returned amounts", () => {
  assert.equal(calldataProblem("0x4e71d92d"), null);
  assert.ok(calldataProblem("4e71d92d"));
  assert.ok(calldataProblem("0x4e71"));
  assert.ok(calldataProblem("0x4e71d92d0"));
  assert.equal(returnedAmount(("0x" + "0".repeat(63) + "5") as `0x${string}`), 5n);
  assert.equal(returnedAmount("0x"), null);
});
