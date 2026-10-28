// Checks behind scripts/verify-deployment.mjs, free of I/O so they can be tested with a fake chain.
//
// How it decides that an address runs this repository's ReclaSourceRegistry:
//   - Runtime code is compared byte for byte with src/lib/contracts/artifacts.json
//     (`npm run contracts:artifacts -- --check` proves that file is a fresh forge build).
//     ReclaSourceRegistry has no immutables and no constructor arguments, so its code must be identical.
//   - The creation transaction is required (no tx => FAIL, never MATCH). It must have succeeded, created exactly the address checked, have no
//     recipient, and its input must be exactly this build's creation code (nothing appended).
// Every check fails closed: an RPC error, an empty or malformed answer is a FAIL, never a skip.

export const CHAIN_ID = 4663;

const isAddr = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isHex = (v) => typeof v === "string" && /^0x([0-9a-fA-F]{2})*$/.test(v);
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** True when `code` is exactly this build's runtime for `kind` (contracts without immutables only). */
export function match(ART, kind, code) {
  const a = ART[kind];
  if (!a || a.immutables.length) return false;
  return String(code).toLowerCase() === a.runtime;
}

/** input: { registry?, registryTx?, rpc, ART }. rpc(method, params) -> result (may throw). Returns { ok, lines }. */
export async function verifyDeployment({ registry, registryTx, rpc, ART }) {
  const encodedArgs = ""; // ReclaSourceRegistry has no constructor arguments
  const lines = [];
  let failed = false;
  const ok = (m) => lines.push(`OK   ${m}`);
  const fail = (m) => {
    failed = true;
    lines.push(`FAIL ${m}`);
  };
  const done = () => ({ ok: !failed, lines });

  try {
    const id = await rpc("eth_chainId", []);
    if (Number(BigInt(id)) !== CHAIN_ID) {
      fail(`chain id ${id}, expected ${CHAIN_ID}`);
      return done();
    }
    ok(`chain id ${CHAIN_ID} (Robinhood Chain)`);
  } catch (e) {
    fail(`chain id unreadable: ${e.message}`);
    return done();
  }
  if (!registry) {
    fail("give --registry");
    return done();
  }
  if (!isAddr(registry)) {
    fail("--registry is not an address");
    return done();
  }
  try {
    const c = await rpc("eth_getCode", [registry, "latest"]);
    if (!isHex(c) || c.length <= 2) throw new Error(`no code at ${registry}`);
    if (match(ART, "ReclaSourceRegistry", c)) ok(`ReclaSourceRegistry at ${registry}: runtime matches this build (no owner, no immutables)`);
    else fail(`ReclaSourceRegistry at ${registry}: runtime differs from this build`);
  } catch (e) {
    fail(`ReclaSourceRegistry: ${e.message}`);
  }
  // Runtime code alone cannot show who deployed it or with what input: without the creation tx the
  // answer is never MATCH.
  if (!registryTx) {
    fail("ReclaSourceRegistry: no creation tx given (pass --registry-tx); runtime alone is not a full match");
    return done();
  }
  if (typeof registryTx !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(registryTx)) {
    fail("ReclaSourceRegistry: --registry-tx is not a 32-byte transaction hash");
    return done();
  }
  try {
    const [tx, rc] = await Promise.all([rpc("eth_getTransactionByHash", [registryTx]), rpc("eth_getTransactionReceipt", [registryTx])]);
    if (!tx || !rc) fail(`ReclaSourceRegistry: creation tx ${registryTx} not found`);
    else if (rc.status !== "0x1") fail("ReclaSourceRegistry: creation tx failed");
    else if (!same(rc.contractAddress, registry)) fail(`ReclaSourceRegistry: tx created ${rc.contractAddress}, not ${registry}`);
    else if (tx.to) fail("ReclaSourceRegistry: tx has a recipient, not a deployment");
    // Creation code plus ABI-encoded constructor arguments; this contract takes none, so nothing may follow.
    else if (String(tx.input).toLowerCase() === ART.ReclaSourceRegistry.creation + encodedArgs) ok("ReclaSourceRegistry: creation input is exactly this build (no constructor arguments)");
    else fail("ReclaSourceRegistry: creation input differs from this build");
  } catch (e) {
    fail(`ReclaSourceRegistry: creation tx unreadable: ${e.message}`);
  }
  return done();
}
