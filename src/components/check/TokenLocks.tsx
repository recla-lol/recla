"use client";

import { useState } from "react";
import { explorerAddress, shortAddress } from "@/config/brand";
import { HOODLOCK } from "@/config/sources";
import { ArrowRight, ArrowUpRight } from "@/components/site/Icons";
import { formatUnits } from "@/lib/claims";
import type { TokenLocksAnswer } from "@/lib/locks-by-token";

const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
const PAGE = 15;
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("en-US", { maximumFractionDigits: v < 0.0001 ? 6 : 2 })}%`);
const when = (t: number) => new Date(t * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC";

/** Check a token's locks: every active HoodLock lock of one token, read by the server from Locked events + getLock. */
export function TokenLocks() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<(TokenLocksAnswer & { cached?: boolean }) | null>(null);
  const [shown, setShown] = useState(PAGE);

  async function run() {
    const t = input.trim();
    if (!isAddr(t)) return setErr("Paste the token's contract address (0x + 40 hex).");
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/locks?token=${t}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "The locks could not be read.");
      setData(j);
      setShown(PAGE);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The locks could not be read.");
    } finally {
      setBusy(false);
    }
  }

  const dec = data?.decimals ?? 18;
  const sym = data?.symbol ?? "tokens";

  return (
    <div className="rc-card p-6" data-testid="token-locks">
      <p className="rc-eyebrow" style={{ fontSize: 10 }}>
        Token locks
      </p>
      <h3 className="rc-h4 mt-3 normal-case tracking-normal">Check a token&apos;s locks</h3>
      <p className="rc-small mt-3">
        Paste a token contract. The server reads every HoodLock Locked event for that token, then asks the locker for each lock again, so withdrawn locks drop out. What stays is what the locker holds
        for the token right now.
      </p>
      <form
        className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label className="rc-field">
          <span className="rc-label">Token contract</span>
          <input className="rc-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" data-testid="token-locks-input" />
        </label>
        <button type="submit" className="rc-btn lime" disabled={busy} data-testid="token-locks-go">
          {busy ? "Reading the locker…" : "Check locks"} <ArrowRight size={13} className="arrow" />
        </button>
      </form>
      {err ? <p className="rc-err mt-3">{err}</p> : null}
      {data ? (
        <div className="mt-8" data-testid="token-locks-result">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rc-card soft p-4">
              <p className="rc-label m-0" style={{ fontSize: 10 }}>
                Active locks
              </p>
              <p className="m-0 mt-2 font-mono text-[18px] text-ink" data-testid="token-locks-count">
                {data.locks.length}
              </p>
              <p className="rc-note m-0 mt-2">
                {data.found} found · {data.withdrawnCount} withdrawn{data.unreadableCount ? ` · ${data.unreadableCount} not readable` : ""}
              </p>
            </div>
            <div className="rc-card soft p-4">
              <p className="rc-label m-0" style={{ fontSize: 10 }}>
                Locked now
              </p>
              <p className="m-0 mt-2 font-mono text-[18px] text-ink">
                {formatUnits(BigInt(data.totalLocked), dec, 2)} {sym}
              </p>
              <p className="rc-note m-0 mt-2">{pct(data.totalShare)} of the total supply</p>
            </div>
            <div className="rc-card soft p-4">
              <p className="rc-label m-0" style={{ fontSize: 10 }}>
                Token
              </p>
              <p className="m-0 mt-2 font-mono text-[18px] text-ink">{data.symbol ?? "?"}</p>
              <p className="rc-note m-0 mt-2">
                <a className="rc-link" href={explorerAddress(data.token)} target="_blank" rel="noreferrer">
                  {shortAddress(data.token)}
                </a>
                {data.decimals === null ? " · decimals not readable, amounts in raw units" : ""}
              </p>
            </div>
          </div>
          {data.locks.length === 0 ? (
            <p className="rc-small mt-6">No active HoodLock lock holds this token.</p>
          ) : (
            <div className="rc-scroll mt-6">
              <table className="rc-table" data-testid="token-locks-table">
                <thead>
                  <tr>
                    <th>Lock</th>
                    <th>Owner</th>
                    <th>Amount</th>
                    <th>Share</th>
                    <th>Unlocks</th>
                  </tr>
                </thead>
                <tbody>
                  {data.locks.slice(0, shown).map((l) => (
                    <tr key={l.id}>
                      <td className="font-mono">
                        <a className="rc-link" href={HOODLOCK.proofUrl(BigInt(l.id))} target="_blank" rel="noreferrer">
                          #{l.id} <ArrowUpRight size={10} />
                        </a>
                      </td>
                      <td className="font-mono">
                        <a className="rc-link" href={explorerAddress(l.owner)} target="_blank" rel="noreferrer">
                          {shortAddress(l.owner)}
                        </a>
                      </td>
                      <td className="font-mono">{formatUnits(BigInt(l.amount), dec, 2)}</td>
                      <td className="font-mono">{pct(l.shareOfSupply)}</td>
                      <td>
                        {when(l.unlockTime)}
                        {l.unlocked ? <span className="text-lime"> · withdrawable</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.locks.length > shown ? (
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button type="button" className="rc-btn line" onClick={() => setShown((n) => n + PAGE)} data-testid="token-locks-more">
                Show {Math.min(PAGE, data.locks.length - shown)} more
              </button>
              <span className="rc-note">
                {shown} of {data.locks.length} shown
              </span>
            </div>
          ) : null}
          <p className="rc-note mt-6">
            {data.complete ? `Every Locked event since block ${data.scannedFrom.toLocaleString("en-US")} was read` : `Newest events only, back to block ${data.scannedFrom.toLocaleString("en-US")}`},
            up to block {data.latest.toLocaleString("en-US")}
            {data.cached ? " (cached for up to 5 minutes)" : ""}. &quot;Withdrawable&quot; means the unlock time has passed; only the lock owner can withdraw. Other sites can read the same answer from{" "}
            <span className="font-mono">/api/locks?token=0x…</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
