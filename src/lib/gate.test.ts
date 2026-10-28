import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData, parseAbi, type Abi } from "viem";
import { ESCROW_ABI, LOCKER_ABI, MERKLE_ABI, REFUND_ABI, VESTING_ABI } from "./abi";
import { describeCall, selectorVerdict, signGate } from "./gate";

const ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";
const LOCKER = "0xD0f7d8c6e9f6D80c297bEbe4F7fD1B9C8125C32F";
const OTHER = "0x000000000000000000000000000000000000dEaD";
const A = "0x00000000000000000000000000000000000000a1";
const enc = (abi: Abi, functionName: string, args: unknown[] = []) => encodeFunctionData({ abi, functionName, args } as never);
const ERC = parseAbi([
  "function approve(address,uint256)",
  "function increaseAllowance(address,uint256)",
  "function setApprovalForAll(address,bool)",
  "function transfer(address,uint256)",
  "function transferFrom(address,address,uint256)",
  "function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
  "function multicall(bytes[])",
  "function execute(address,uint256,bytes)",
]);

test("every call the adapters build passes the selector gate", () => {
  const calls = [
    enc(ESCROW_ABI as Abi, "claim"),
    enc(ESCROW_ABI as Abi, "claimToken", [A]),
    enc(LOCKER_ABI as Abi, "withdraw", [7n]),
    enc(VESTING_ABI as Abi, "release"),
    enc(VESTING_ABI as Abi, "release", [A]),
    enc(REFUND_ABI as Abi, "claimRefund"),
    enc(MERKLE_ABI as Abi, "claim", [1n, A, 5n, []]),
  ];
  for (const d of calls) assert.equal(selectorVerdict(d).kind, "claim", d.slice(0, 10));
});

test("approvals, transfers, permits and batches are hard-blocked", () => {
  const big = 2n ** 256n - 1n;
  const bad = [
    enc(ERC, "approve", [A, big]),
    enc(ERC, "increaseAllowance", [A, big]),
    enc(ERC, "setApprovalForAll", [A, true]),
    enc(ERC, "transfer", [A, 1n]),
    enc(ERC, "transferFrom", [A, A, 1n]),
    enc(ERC, "permit", [A, A, 1n, 1n, 27, `0x${"11".repeat(32)}`, `0x${"22".repeat(32)}`]),
    enc(ERC, "multicall", [[enc(ESCROW_ABI as Abi, "claim")]]),
    enc(ERC, "execute", [A, 0n, "0x"]),
  ];
  for (const d of bad) {
    const v = selectorVerdict(d);
    assert.equal(v.kind, "blocked", d.slice(0, 10));
    assert.match(v.reason!, /never ask your wallet/);
    assert.equal(signGate(d, ESCROW, true).ok, false);
  }
});

test("unknown and malformed selectors are refused", () => {
  assert.equal(selectorVerdict("0xdeadbeef").kind, "unknown");
  assert.equal(signGate("0xdeadbeef", ESCROW, true).ok, false);
  assert.equal(selectorVerdict("0x4e71").kind, "invalid");
  assert.equal(selectorVerdict("hello").kind, "invalid");
  assert.equal(selectorVerdict("0x4e71d92d0").kind, "invalid");
});

test("a claim call is signable only on a built-in or registered source", () => {
  const claim = enc(ESCROW_ABI as Abi, "claim");
  assert.equal(signGate(claim, ESCROW, false).ok, true);
  assert.equal(signGate(claim, ESCROW.toLowerCase(), false).ok, true);
  assert.equal(signGate(enc(LOCKER_ABI as Abi, "withdraw", [1n]), LOCKER, false).ok, true);
  const out = signGate(claim, OTHER, false);
  assert.ok(!out.ok && /not registered/.test(out.reason));
  assert.equal(signGate(claim, OTHER, true).ok, true);
});

test("calls are described for display, including blocked ones", () => {
  assert.equal(describeCall(enc(LOCKER_ABI as Abi, "withdraw", [12n])), "withdraw(12)");
  assert.match(describeCall(enc(ERC, "approve", [A, 5n])) ?? "", /^approve\(0x0+a1, 5\)$/i);
  assert.equal(describeCall("0xdeadbeef"), null);
});
