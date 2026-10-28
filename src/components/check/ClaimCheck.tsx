"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getAddress } from "viem";
import { BRAND, CHAIN } from "@/config/brand";
import { registryLive } from "@/config/contracts";
import { HOODLOCK, PONS_ESCROW } from "@/config/sources";
import { ClaimRows } from "@/components/check/ClaimRows";
import { ArrowRight } from "@/components/site/Icons";
import { useWallet } from "@/components/wallet/WalletProvider";
import { readEscrowGeneric, readLocks, readPonsEscrow, readRefund, readVesting, type ClaimRow } from "@/lib/claims";
import { latestEntries } from "@/lib/registry";

type SourceState = { key: string; name: string; state: "idle" | "reading" | "done" | "error"; rows: ClaimRow[]; note?: string };

const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

/** Claim Discovery + Eligibility for one address across every source with a confirmed read path. */
export function ClaimCheck() {
  const params = useSearchParams();
  const { address } = useWallet();
  const [input, setInput] = useState(params.get("address") ?? "");
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceState[]>([]);

  const set = (key: string, patch: Partial<SourceState>) => setSources((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const run = useCallback(async (raw: string) => {
    if (!isAddr(raw)) {
      setErr("Paste a 0x address (42 characters) or connect a wallet.");
      return;
    }
    setErr(null);
    const acct = getAddress(raw);
    setAccount(acct);
    const list: SourceState[] = [
      { key: "pons", name: PONS_ESCROW.name, state: "reading", rows: [] },
      { key: "lock", name: HOODLOCK.name, state: "reading", rows: [] },
      ...(registryLive() ? [{ key: "registry", name: "Registered sources", state: "reading" as const, rows: [] }] : []),
    ];
    setSources(list);
    readPonsEscrow(acct)
      .then(async (rows) => {
        set("pons", { state: "done", rows });
        // Pair-token credits are found from this address's history; read those balances too.
        const h = await fetch(`/api/history?address=${acct}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const extra: string[] = Array.isArray(h?.creditedTokens) ? h.creditedTokens : [];
        if (extra.length) set("pons", { state: "done", rows: await readPonsEscrow(acct, extra) });
      })
      .catch(() => set("pons", { state: "error", note: "The escrow could not be read just now." }));
    readLocks(acct)
      .then((rows) => set("lock", { state: "done", rows, note: rows.length === 0 ? "No HoodLock locks are owned by this address." : undefined }))
      .catch(() => set("lock", { state: "error", note: "The locker could not be read just now." }));
    if (registryLive()) {
      latestEntries(60)
        .then(async ({ rows: entries }) => {
          const out: ClaimRow[] = [];
          let merkle = 0;
          for (const e of entries) {
            if (e.kind === 2) out.push({ ...(await readVesting(e.source, acct)), sourceName: e.label });
            else if (e.kind === 3) out.push({ ...(await readRefund(e.source, acct)), sourceName: e.label });
            else if (e.kind === 4) out.push(await readEscrowGeneric(e.source, acct, e.label));
            else if (e.kind === 1) merkle++;
          }
          set("registry", {
            state: "done",
            rows: out.filter((r) => r.status !== "unreadable" || r.sourceKey === "refund"),
            note: `${entries.length} registered source(s) read.${merkle ? ` ${merkle} Merkle source(s) need your proof file: use the Merkle check below.` : ""}`,
          });
        })
        .catch(() => set("registry", { state: "error", note: "The registry could not be read just now." }));
    }
  }, []);

  useEffect(() => {
    const q = params.get("address");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a shared link starts the check once
    if (q && isAddr(q)) void run(q);
  }, [params, run]);

  const all = sources.flatMap((s) => s.rows);
  const claimable = all.filter((r) => r.status === "claimable").length;
  const busy = sources.some((s) => s.state === "reading");

  return (
    <div>
      <form
        className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run(input.trim());
        }}
      >
        <label className="rc-field">
          <span className="rc-label">Address to check</span>
          <input className="rc-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" data-testid="check-input" />
        </label>
        <button type="submit" className="rc-btn lime lg" disabled={busy} data-testid="check-go">
          {busy ? "Reading…" : "Check claims"} <ArrowRight size={14} className="arrow" />
        </button>
        {address ? (
          <button
            type="button"
            className="rc-btn line lg"
            onClick={() => {
              setInput(address);
              void run(address);
            }}
          >
            Use my wallet
          </button>
        ) : null}
      </form>
      {err ? <p className="rc-err mt-3">{err}</p> : null}

      {account ? (
        <div className="mt-12" data-testid="check-result">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="rc-label m-0">
              Result for <span className="font-mono text-ink normal-case">{account}</span>
            </p>
            <p className="rc-mono m-0 text-lime" data-testid="claimable-count">
              {busy ? "reading…" : `${claimable} claimable now`}
            </p>
          </div>
          {sources.map((s) => (
            <div key={s.key} className="mt-8">
              <p className="rc-eyebrow" style={{ fontSize: 10 }}>
                {s.name} {s.state === "reading" ? "· reading" : ""}
              </p>
              {s.note ? <p className="rc-small mt-2 text-muted">{s.note}</p> : null}
              <div className="mt-3">
                <ClaimRows rows={s.rows} account={account} />
              </div>
            </div>
          ))}
          <p className="rc-small mt-10 max-w-[760px] text-muted">
            An empty result means none of the sources above owes this address anything right now. It says nothing about contracts {BRAND.name} does not read. Read on {CHAIN.name} at {new Date().toISOString().slice(11, 16)} UTC.
          </p>
        </div>
      ) : null}
    </div>
  );
}
