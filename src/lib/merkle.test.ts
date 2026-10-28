import { test } from "node:test";
import assert from "node:assert/strict";
import type { Hex } from "viem";
import { ProofError, claimRoot, distributorLeaf, findClaim, hashPair, standardLeaf, toBig } from "./merkle";

const A = "0x00000000000000000000000000000000000000a1" as const;
const B = "0x00000000000000000000000000000000000000b2" as const;
const C = "0x00000000000000000000000000000000000000c3" as const;
const D = "0x00000000000000000000000000000000000000d4" as const;

/** Builds a distributor file (four leaves, sorted-pair tree) the way distributor tools do. */
function distributorFile() {
  const rows = [
    { index: 0n, account: A, amount: 100n },
    { index: 1n, account: B, amount: 250n },
    { index: 2n, account: C, amount: 7n },
    { index: 3n, account: D, amount: 1n },
  ];
  const leaves = rows.map((r) => distributorLeaf(r.index, r.account, r.amount));
  const l1 = [hashPair(leaves[0], leaves[1]), hashPair(leaves[2], leaves[3])];
  const root = hashPair(l1[0], l1[1]);
  const proofs: Hex[][] = [
    [leaves[1], l1[1]],
    [leaves[0], l1[1]],
    [leaves[3], l1[0]],
    [leaves[2], l1[0]],
  ];
  const claims: Record<string, unknown> = {};
  rows.forEach((r, i) => (claims[r.account] = { index: Number(r.index), amount: `0x${r.amount.toString(16)}`, proof: proofs[i] }));
  return { root, text: JSON.stringify({ merkleRoot: root, tokenTotal: "0x166", claims }) };
}

/** A StandardMerkleTree dump with three leaves, laid out as the OpenZeppelin library does. */
function standardFile() {
  const enc = ["address", "uint256"];
  const vals = [
    [A, "500"],
    [B, "42"],
    [C, "9"],
  ];
  const leaves = vals.map((v) => standardLeaf(enc, v));
  // Leaves are placed sorted at the end of the array; tree[0] is the root.
  const sorted = [...leaves].sort((x, y) => (BigInt(x) < BigInt(y) ? -1 : 1));
  const tree: Hex[] = new Array(5);
  for (let i = 0; i < 3; i++) tree[4 - i] = sorted[i];
  for (let i = 1; i >= 0; i--) tree[i] = hashPair(tree[2 * i + 1], tree[2 * i + 2]);
  const values = vals.map((value) => ({ value, treeIndex: tree.indexOf(standardLeaf(enc, value)) }));
  return { root: tree[0], text: JSON.stringify({ format: "standard-v1", tree, values, leafEncoding: enc }) };
}

test("distributor file: finds the account, rebuilds the root", () => {
  const f = distributorFile();
  for (const [acct, amount] of [
    [A, 100n],
    [B, 250n],
    [C, 7n],
    [D, 1n],
  ] as const) {
    const c = findClaim(f.text, acct);
    assert.equal(c.amount, amount);
    assert.equal(claimRoot(c), f.root);
    assert.equal(c.fileRoot, f.root);
  }
});

test("addresses are matched case-insensitively", () => {
  const f = distributorFile();
  assert.equal(findClaim(f.text, "0x00000000000000000000000000000000000000B2").amount, 250n);
});

test("an address that is not in the file is not eligible", () => {
  const f = distributorFile();
  assert.throws(() => findClaim(f.text, "0x00000000000000000000000000000000000000e5"), (e) => e instanceof ProofError && /not eligible/.test(e.message));
});

test("a changed amount no longer reaches the root", () => {
  const f = distributorFile();
  const j = JSON.parse(f.text);
  j.claims[A].amount = "0x65";
  const c = findClaim(JSON.stringify(j), A);
  assert.notEqual(claimRoot(c), f.root);
});

test("a single claim object works and rejects someone else's entry", () => {
  const f = distributorFile();
  const j = JSON.parse(f.text);
  const single = { ...j.claims[C], account: C };
  assert.equal(claimRoot(findClaim(JSON.stringify(single), C)), f.root);
  assert.throws(() => findClaim(JSON.stringify(single), A), ProofError);
});

test("standard tree dump: proof rebuilt from the tree reaches tree[0]", () => {
  const f = standardFile();
  for (const [acct, amount] of [
    [A, 500n],
    [B, 42n],
    [C, 9n],
  ] as const) {
    const c = findClaim(f.text, acct);
    assert.equal(c.format, "standard");
    assert.equal(c.amount, amount);
    assert.equal(claimRoot(c), f.root);
  }
});

test("a tampered standard leaf is detected", () => {
  const f = standardFile();
  const j = JSON.parse(f.text);
  j.values[0].value[1] = "501";
  assert.throws(() => findClaim(JSON.stringify(j), A), /changed/);
});

test("bad input gets plain reasons", () => {
  assert.throws(() => findClaim("{", A), /not valid JSON/);
  assert.throws(() => findClaim("{}", A), /does not recognise/);
  assert.throws(() => findClaim("{}", "nope"), /address/);
  assert.throws(() => findClaim(JSON.stringify({ index: 0, amount: 1, proof: ["0x12"] }), A), /32-byte/);
});

test("amounts: decimal, hex and safe numbers only", () => {
  assert.equal(toBig("123", "x"), 123n);
  assert.equal(toBig("0xff", "x"), 255n);
  assert.equal(toBig(5, "x"), 5n);
  assert.throws(() => toBig(1.5, "x"));
  assert.throws(() => toBig("-1", "x"));
  assert.throws(() => toBig("1e18", "x"));
});
