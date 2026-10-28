"use client";

import { useState } from "react";
import { getAddress } from "viem";
import { ClaimRows } from "@/components/check/ClaimRows";
import { useWallet } from "@/components/wallet/WalletProvider";
import { hasCode, readMerkle, readVesting, type ClaimRow, type MerkleCheck } from "@/lib/claims";
import { ProofError, claimRoot, findClaim } from "@/lib/merkle";

const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

/** Merkle eligibility: distributor address + the proof file the distributor published. Checked in the browser. */
export function MerkleChecker() {
  const { address } = useWallet();
  const [acct, setAcct] = useState("");
  const [dist, setDist] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<(MerkleCheck & { computed: string; account: string }) | null>(null);

  async function run() {
    setErr(null);
    setOut(null);
    const who = (acct || address || "").trim();
    if (!isAddr(dist.trim())) return setErr("Paste the distributor contract address (0x…).");
    setBusy(true);
    try {
      const claim = findClaim(text, who);
      const d = getAddress(dist.trim());
      if (!(await hasCode(d))) throw new ProofError("There is no contract at that distributor address on Robinhood Chain.");
      const r = await readMerkle(d, claim);
      setOut({ ...r, computed: claimRoot(claim), account: claim.account });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The check failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rc-card p-6" data-testid="merkle-checker">
      <p className="rc-eyebrow" style={{ fontSize: 10 }}>
        Merkle eligibility
      </p>
      <h3 className="rc-h4 mt-3 normal-case tracking-normal">Check a distribution with your own proof file</h3>
      <p className="rc-small mt-3">
        Paste the distributor&apos;s contract and the proof file it published (a claims map, a single claim, or a standard tree dump). Your leaf and the root are computed in this browser; only the contract&apos;s root and isClaimed(index) are read from chain.
      </p>
      <div className="mt-5 grid gap-3">
        <label className="rc-field">
          <span className="rc-label">Distributor contract</span>
          <input className="rc-input" value={dist} onChange={(e) => setDist(e.target.value)} placeholder="0x…" spellCheck={false} data-testid="merkle-dist" />
        </label>
        <label className="rc-field">
          <span className="rc-label">Address (empty = connected wallet)</span>
          <input className="rc-input" value={acct} onChange={(e) => setAcct(e.target.value)} placeholder={address ?? "0x…"} spellCheck={false} data-testid="merkle-acct" />
        </label>
        <label className="rc-field">
          <span className="rc-label">Proof file (JSON)</span>
          <textarea className="rc-textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"merkleRoot":"0x…","claims":{"0x…":{"index":0,"amount":"0x…","proof":["0x…"]}}}' spellCheck={false} data-testid="merkle-json" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="rc-btn lime" onClick={run} disabled={busy} data-testid="merkle-go">
            {busy ? "Checking…" : "Check eligibility"}
          </button>
          <label className="rc-btn ghost cursor-pointer">
            Load a file
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 5 * 1024 * 1024) return setErr("The file is larger than 5 MB.");
                setText(await f.text());
              }}
            />
          </label>
        </div>
      </div>
      {err ? <p className="rc-err mt-4" data-testid="merkle-err">{err}</p> : null}
      {out ? (
        <div className="mt-6" data-testid="merkle-result">
          <dl className="m-0 grid gap-2 font-mono text-[12px] text-soft">
            <div>
              <dt className="rc-label inline">Root from your proof </dt>
              <dd className="m-0 inline break-all">{out.computed}</dd>
            </div>
            <div>
              <dt className="rc-label inline">Root in the contract </dt>
              <dd className="m-0 inline break-all">{out.root ?? "not readable"}</dd>
            </div>
            <div>
              <dt className="rc-label inline">Match </dt>
              <dd className={`m-0 inline ${out.rootMatches ? "rc-ok" : "text-coral"}`}>{out.rootMatches ? "yes" : "no"}</dd>
              {out.fileRootMatches === false ? <dd className="m-0 text-coral">The root written in the file differs from the contract&apos;s: this file belongs to another distribution.</dd> : null}
            </div>
          </dl>
          <div className="mt-4">
            <ClaimRows rows={[out.row]} account={out.account} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Vesting wallet: beneficiary check + releasable amount for ETH or one token. */
export function VestingChecker() {
  const { address } = useWallet();
  const [src, setSrc] = useState("");
  const [token, setToken] = useState("");
  const [acct, setAcct] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [row, setRow] = useState<ClaimRow | null>(null);
  async function run() {
    setErr(null);
    setRow(null);
    const who = (acct || address || "").trim();
    if (!isAddr(src.trim())) return setErr("Paste the vesting contract address (0x…).");
    if (!isAddr(who)) return setErr("Paste the address to check, or connect a wallet.");
    if (token && !isAddr(token.trim())) return setErr("The token must be a 0x address, or empty for ETH.");
    setBusy(true);
    try {
      const s = getAddress(src.trim());
      if (!(await hasCode(s))) throw new Error("There is no contract at that address on Robinhood Chain.");
      setRow(await readVesting(s, getAddress(who), token.trim() || undefined));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The check failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rc-card p-6" data-testid="vesting-checker">
      <p className="rc-eyebrow" style={{ fontSize: 10 }}>
        Vesting tracker
      </p>
      <h3 className="rc-h4 mt-3 normal-case tracking-normal">Check a vesting wallet</h3>
      <p className="rc-small mt-3">For vesting wallets that name their beneficiary with owner() and report releasable(). Other vesting designs are not read; they show as not readable.</p>
      <div className="mt-5 grid gap-3">
        <label className="rc-field">
          <span className="rc-label">Vesting contract</span>
          <input className="rc-input" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="0x…" spellCheck={false} />
        </label>
        <label className="rc-field">
          <span className="rc-label">Token (empty = ETH)</span>
          <input className="rc-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="0x… or empty" spellCheck={false} />
        </label>
        <label className="rc-field">
          <span className="rc-label">Address (empty = connected wallet)</span>
          <input className="rc-input" value={acct} onChange={(e) => setAcct(e.target.value)} placeholder={address ?? "0x…"} spellCheck={false} />
        </label>
        <button type="button" className="rc-btn lime w-fit" onClick={run} disabled={busy}>
          {busy ? "Reading…" : "Read vesting"}
        </button>
      </div>
      {err ? <p className="rc-err mt-4">{err}</p> : null}
      {row ? (
        <div className="mt-6">
          <ClaimRows rows={[row]} account={(acct || address || "").trim()} />
        </div>
      ) : null}
    </div>
  );
}
