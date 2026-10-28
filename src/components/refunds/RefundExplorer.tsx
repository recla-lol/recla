"use client";

import { useEffect, useState } from "react";
import { getAddress } from "viem";
import { registryLive } from "@/config/contracts";
import { ClaimRows } from "@/components/check/ClaimRows";
import { useWallet } from "@/components/wallet/WalletProvider";
import { hasCode, readRefund, type ClaimRow } from "@/lib/claims";
import { latestEntries, type Entry } from "@/lib/registry";

const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

/** Refund Explorer: only refunds a contract explicitly states through a refund view. */
export function RefundExplorer() {
  const { address } = useWallet();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [src, setSrc] = useState("");
  const [acct, setAcct] = useState("");
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!registryLive()) return;
    latestEntries(100)
      .then((r) => setEntries(r.rows.filter((e) => e.kind === 3)))
      .catch(() => setEntries([]));
  }, []);

  async function run() {
    setErr(null);
    setRows([]);
    const who = (acct || address || "").trim();
    if (!isAddr(who)) return setErr("Paste the address to check, or connect a wallet.");
    const targets = src.trim() ? [src.trim()] : (entries ?? []).map((e) => e.source);
    if (src.trim() && !isAddr(src.trim())) return setErr("The refund contract must be a 0x address.");
    if (targets.length === 0) return setErr("No refund source is registered yet. Paste a refund contract to read it.");
    setBusy(true);
    try {
      const out: ClaimRow[] = [];
      for (const t of targets.slice(0, 20)) {
        const a = getAddress(t);
        if (!(await hasCode(a))) {
          out.push({ id: `nocode-${a}`, sourceKey: "refund", sourceName: "Refund source", source: a, title: "No contract", status: "unreadable", amount: 0n, token: { address: null, symbol: "ETH", decimals: 18 }, why: "There is no contract at this address.", action: null });
          continue;
        }
        out.push(await readRefund(a, getAddress(who)));
      }
      setRows(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The read failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rc-card p-6" data-testid="refund-explorer">
        <div className="grid gap-3">
          <label className="rc-field">
            <span className="rc-label">Refund contract (empty = every registered refund source)</span>
            <input className="rc-input" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="0x…" spellCheck={false} data-testid="refund-src" />
          </label>
          <label className="rc-field">
            <span className="rc-label">Address (empty = connected wallet)</span>
            <input className="rc-input" value={acct} onChange={(e) => setAcct(e.target.value)} placeholder={address ?? "0x…"} spellCheck={false} />
          </label>
          <button type="button" className="rc-btn lime w-fit" onClick={run} disabled={busy} data-testid="refund-go">
            {busy ? "Reading…" : "Read refunds"}
          </button>
          {err ? <p className="rc-err" data-testid="refund-err">{err}</p> : null}
        </div>
        <div className="mt-6">
          <ClaimRows rows={rows} account={(acct || address || "").trim()} />
        </div>
      </div>
      <div className="rc-card soft h-fit p-6">
        <span className="rc-label">Supported refund sources today</span>
        <p className="mt-4 font-display text-[22px] font-semibold text-ink" data-testid="refund-count">
          {registryLive() ? (entries === null ? "reading…" : entries.length) : 0}
        </p>
        <p className="rc-small mt-3">
          {registryLive()
            ? "Refund sources come from the registry (kind: refund)."
            : "None yet. Neither built-in source pays refunds, and the registry where refund contracts will be listed is not deployed yet."}{" "}
          A contract counts only if it states the refund itself through refundOf, refundable or refunds(address). Recla never estimates a refund from your transaction history.
        </p>
      </div>
    </div>
  );
}
