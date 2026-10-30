"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { explorerAddress, explorerBlock, explorerTx, shortAddress } from "@/config/brand";
import { ArrowRight } from "@/components/site/Icons";
import { useWallet } from "@/components/wallet/WalletProvider";
import { formatUnits, tokenInfo, type TokenInfo } from "@/lib/claims";
import type { HistoryEvent } from "@/lib/history";

type Src = { key: string; name: string; address: string; ok: boolean; error: string | null; events: HistoryEvent[]; scannedFrom: number | null; complete: boolean };
type Answer = { account: string; latest: number; at: number; sources: Src[]; cached?: boolean };
type Kind = "merkle" | "vesting";
const KIND_LABEL: Record<Kind, string> = { merkle: "Merkle distributor", vesting: "Vesting wallet" };

const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

function Amount({ e }: { e: HistoryEvent }) {
  const [t, setT] = useState<TokenInfo | null>(null);
  useEffect(() => {
    if (e.token) void tokenInfo(e.token).then(setT);
  }, [e.token]);
  if (e.amount === null) return <>—</>;
  // Pons ETH claims and vesting ETH releases are in wei; token events carry their token; lock amounts are in the lock's token.
  if (e.token) return <>{t ? `${formatUnits(BigInt(e.amount), t.decimals)} ${t.symbol}` : e.amount}</>;
  if (e.source === "pons" || e.kind === "EtherReleased") return <>{formatUnits(BigInt(e.amount), 18)} ETH</>;
  return <>{e.amount} (raw units)</>;
}

/** Claim History: claim-related events of a wallet, read from chain by the server for each supported source. */
export function HistoryView() {
  const q = useSearchParams();
  const { address } = useWallet();
  const [input, setInput] = useState(q.get("address") ?? "");
  const [source, setSource] = useState(q.get("source") ?? "");
  const [kind, setKind] = useState<Kind>(q.get("kind") === "vesting" ? "vesting" : "merkle");
  const [named, setNamed] = useState<{ source: string; kind: Kind } | null>(null);
  const [data, setData] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Wallet history across the built-in sources, or, with `src`, the wallet's events on one source the visitor names. */
  const run = useCallback(async (a: string, src?: { source: string; kind: Kind }) => {
    if (!isAddr(a)) return setErr("Paste a 0x address or connect a wallet.");
    if (src && !isAddr(src.source)) return setErr("The named source must be a 0x contract address, or leave it empty.");
    setErr(null);
    setBusy(true);
    try {
      const qs = new URLSearchParams({ address: a, ...(src ? { source: src.source, kind: src.kind } : {}) });
      const r = await fetch(`/api/history?${qs.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "History could not be read.");
      setData(j);
      setNamed(src ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "History could not be read.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const a = q.get("address");
    const s = q.get("source");
    const k = q.get("kind");
    const src = s && isAddr(s) && (k === "merkle" || k === "vesting") ? { source: s, kind: k as Kind } : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a shared link loads once
    if (a && isAddr(a)) void run(a, src);
  }, [q, run]);

  const namedNow = () => (source.trim() ? { source: source.trim(), kind } : undefined);
  const events = data?.sources.flatMap((s) => s.events.map((e) => ({ ...e, sourceName: s.name }))).sort((a, b) => b.block - a.block) ?? [];

  return (
    <div>
      <form
        className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run(input.trim(), namedNow());
        }}
      >
        <label className="rc-field">
          <span className="rc-label">Wallet</span>
          <input className="rc-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="0x…" spellCheck={false} data-testid="history-input" />
        </label>
        <button className="rc-btn lime lg" type="submit" disabled={busy} data-testid="history-go">
          {busy ? "Reading the chain…" : "Read history"} <ArrowRight size={14} className="arrow" />
        </button>
        {address ? (
          <button
            type="button"
            className="rc-btn line lg"
            onClick={() => {
              setInput(address);
              void run(address, namedNow());
            }}
          >
            My wallet
          </button>
        ) : null}
      </form>
      <fieldset className="mt-4 grid gap-3 border-0 p-0 md:grid-cols-[minmax(0,1fr)_220px] md:items-end" data-testid="history-named">
        <label className="rc-field">
          <span className="rc-label">Source you name (optional): a distributor or vesting wallet</span>
          <input
            className="rc-input"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="0x… (empty = the built-in sources)"
            spellCheck={false}
            autoComplete="off"
            data-testid="history-source"
          />
        </label>
        <label className="rc-field">
          <span className="rc-label">Kind</span>
          <select className="rc-select" value={kind} onChange={(e) => setKind(e.target.value === "vesting" ? "vesting" : "merkle")} data-testid="history-kind">
            <option value="merkle">Merkle distributor</option>
            <option value="vesting">Vesting wallet</option>
          </select>
        </label>
      </fieldset>
      <p className="rc-note mt-2">With a named source, only that contract is read: Merkle claims of this wallet, or every release of the vesting wallet, over the newest 30M blocks.</p>
      {err ? <p className="rc-err mt-3">{err}</p> : null}
      {data ? (
        <div className="mt-10" data-testid="history-result">
          {named ? (
            <p className="rc-label mb-4">
              Filtered to {KIND_LABEL[named.kind]}{" "}
              <a className="rc-link normal-case" href={explorerAddress(named.source)} target="_blank" rel="noreferrer">
                {shortAddress(named.source)}
              </a>
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            {data.sources.map((s) => (
              <div key={s.key} className="rc-card p-4">
                <p className="rc-label m-0" style={{ fontSize: 10 }}>
                  {s.name}
                </p>
                <p className="m-0 mt-2 font-mono text-[18px] text-ink">{s.ok ? `${s.events.length} event${s.events.length === 1 ? "" : "s"}` : "not read"}</p>
                <p className="rc-note m-0 mt-2">
                  {s.ok
                    ? s.complete
                      ? `Whole history scanned (from block ${s.scannedFrom?.toLocaleString("en-US")}).`
                      : `Newest events only; scanned back to block ${s.scannedFrom?.toLocaleString("en-US")}.`
                    : (s.error ?? "read failed")}{" "}
                  <a className="rc-link" href={explorerAddress(s.address)} target="_blank" rel="noreferrer">
                    {shortAddress(s.address)}
                  </a>
                </p>
              </div>
            ))}
          </div>
          {events.length === 0 ? (
            <p className="rc-small mt-8">{named ? "No matching events on this source in the blocks read." : "No claim-related events for this wallet in the supported sources."}</p>
          ) : (
            <div className="rc-scroll mt-8">
              <table className="rc-table" data-testid="history-table">
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Source</th>
                    <th>Event</th>
                    <th>Amount</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, i) => (
                    <tr key={`${e.tx}-${i}`}>
                      <td className="font-mono">
                        <a className="rc-link" href={explorerBlock(e.block)} target="_blank" rel="noreferrer">
                          {e.block.toLocaleString("en-US")}
                        </a>
                      </td>
                      <td>{e.sourceName}</td>
                      <td>
                        {e.label}
                        {e.ref ? ` ${e.ref}` : ""}
                      </td>
                      <td className="font-mono">
                        <Amount e={e} />
                      </td>
                      <td className="font-mono">
                        <a className="rc-link" href={explorerTx(e.tx)} target="_blank" rel="noreferrer">
                          {shortAddress(e.tx, 8, 6)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="rc-note mt-6">
            Read up to block {data.latest.toLocaleString("en-US")}
            {data.cached ? " (cached for up to 10 minutes)" : ""}. Lock amounts are shown in the token&apos;s raw units.
          </p>
        </div>
      ) : null}
    </div>
  );
}
