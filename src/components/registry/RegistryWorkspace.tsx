"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress } from "viem";
import { CHAIN, explorerAddress, explorerTx, shortAddress } from "@/config/brand";
import { registryLive } from "@/config/contracts";
import { GAS, gasCostEth } from "@/config/gas";
import { KINDS, REASONS, kindLabel } from "@/config/sources";
import { storageKey } from "@/config/storage";
import { useChain } from "@/components/providers/ChainProvider";
import { SourceFacts } from "@/components/sources/SourceFacts";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { hasCode } from "@/lib/claims";
import { explain } from "@/lib/client";
import { latestEntries, sendAttest, sendFlag, sendRegister, stanceOf, type Entry } from "@/lib/registry";
import { RuleError, labelProblem, practiceRegister, practiceRespond, rulesHashOf, urlProblem, type PracticeState } from "@/lib/rules";

type Row = Entry & { mine?: { stance: number; reason: number } };

const PRACTICE_KEY = storageKey("practice", "registry");

/** ReclaSourceRegistry: register a claim source, attest its rules or flag it. Practice mode until deployed. */
export function RegistryWorkspace() {
  const live = registryLive();
  const { address, onRobinhoodChain, sendTransaction, signMessage, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const { facts } = useChain();
  const [practice, setPractice] = useLocalStore<PracticeState>(PRACTICE_KEY, { entries: [] });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(live);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; tx?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ source: "", kind: 1, rulesUrl: "https://", rules: "", label: "" });
  const [reason, setReason] = useState<Record<number, number>>({});

  const load = useCallback(async () => {
    if (!live) return;
    setLoading(true);
    try {
      const { rows: r } = await latestEntries(100);
      const withMine = address ? await Promise.all(r.map(async (e) => ({ ...e, mine: await stanceOf(e.id, address).catch(() => undefined) }))) : r;
      setRows(withMine);
    } catch {
      setMsg({ ok: false, text: "The registry could not be read just now." });
    } finally {
      setLoading(false);
    }
  }, [live, address]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the chain after mount
    void load();
  }, [load]);

  const list: Row[] = live
    ? rows
    : [...practice.entries].reverse().map((e) => ({
        id: e.id,
        source: e.source as `0x${string}`,
        kind: e.kind,
        registrant: e.registrant as `0x${string}`,
        registeredBlock: 0,
        registeredAt: Math.floor(e.at / 1000),
        attestCount: e.attestCount,
        flagCount: e.flagCount,
        rulesHash: e.rulesHash as `0x${string}`,
        rulesUrl: e.rulesUrl,
        label: e.label,
        mine: address ? (e.stances[address.toLowerCase()] ? { stance: e.stances[address.toLowerCase()].s, reason: e.stances[address.toLowerCase()].r } : { stance: 0, reason: 0 }) : undefined,
      }));

  const ready = () => {
    if (!address) {
      open();
      return false;
    }
    if (live && !onRobinhoodChain) {
      void switchNetwork();
      return false;
    }
    return true;
  };

  async function register() {
    setMsg(null);
    if (!ready() || !address) return;
    const src = form.source.trim();
    const problem = !/^0x[0-9a-fA-F]{40}$/.test(src) ? "The source must be a 0x contract address." : urlProblem(form.rulesUrl.trim()) ?? labelProblem(form.label) ?? (rulesHashOf(form.rules) ? null : "Paste the rules text (or its keccak256 hash).");
    if (problem) return setMsg({ ok: false, text: problem });
    const e = { source: getAddress(src), kind: form.kind, rulesUrl: form.rulesUrl.trim(), rulesHash: rulesHashOf(form.rules)!, label: form.label };
    setBusy(true);
    try {
      if (!(await hasCode(e.source))) throw new RuleError("That address holds no contract code on Robinhood Chain.");
      if (live) {
        const r = await sendRegister(address, e, sendTransaction);
        await load();
        setMsg({ ok: true, text: "Registered on chain.", tx: r.hash });
      } else {
        practiceRegister(practice, address, { ...e, sig: "0x" });
        const sig = await signMessage(`Recla practice registration (nothing is sent)\nsource ${e.source}\nkind ${e.kind}\nrules ${e.rulesHash}\nlabel ${e.label}`);
        setPractice(practiceRegister(practice, address, { ...e, sig }));
        setMsg({ ok: true, text: "Signed and saved in this browser (practice mode, nothing sent)." });
      }
      setForm({ source: "", kind: 1, rulesUrl: "https://", rules: "", label: "" });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof RuleError ? err.message : explain(err) });
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: number, stance: 1 | 2) {
    setMsg(null);
    if (!ready() || !address) return;
    const r = reason[id] ?? 0;
    if (stance === 2 && !r) return setMsg({ ok: false, text: "Pick a flag reason first." });
    setBusy(true);
    try {
      if (live) {
        const out = stance === 1 ? await sendAttest(address, id, sendTransaction) : await sendFlag(address, id, r, sendTransaction);
        await load();
        setMsg({ ok: true, text: stance === 1 ? "Attestation recorded on chain." : "Flag recorded on chain.", tx: out.hash });
      } else {
        practiceRespond(practice, address, id, stance, r);
        await signMessage(`Recla practice ${stance === 1 ? "attestation" : `flag (reason ${r})`} for entry ${id} (nothing is sent)`);
        setPractice(practiceRespond(practice, address, id, stance, r));
        setMsg({ ok: true, text: "Signed and saved in this browser (practice mode, nothing sent)." });
      }
    } catch (err) {
      setMsg({ ok: false, text: err instanceof RuleError ? err.message : explain(err) });
    } finally {
      setBusy(false);
    }
  }

  const cost = (u: number) => {
    const eth = gasCostEth(u, facts?.gasGwei ?? null);
    return eth === null ? "—" : `≈ ${eth.toFixed(7)} ETH${facts?.ethUsd ? ` ($${(eth * facts.ethUsd).toFixed(4)})` : ""}`;
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rc-label">{live ? "Entries on chain, newest first" : "Practice entries in this browser"}</span>
          <span className={`rc-pill ${live ? "lime" : "amber"}`}>
            <span className="sq" /> {live ? "Live registry" : "Practice mode"}
          </span>
        </div>
        {!live ? (
          <p className="rc-small mt-3 text-muted">The registry contract is written and tested but not deployed yet. Until it is, every action here is signed with your wallet (a message, not a transaction) and kept in this browser only.</p>
        ) : null}
        {msg ? (
          <p className={`mt-4 text-[14px] ${msg.ok ? "rc-ok" : "rc-err"}`} data-testid="registry-msg">
            {msg.text}{" "}
            {msg.tx ? (
              <a className="rc-link" href={explorerTx(msg.tx)} target="_blank" rel="noreferrer">
                View transaction
              </a>
            ) : null}
          </p>
        ) : null}
        {loading ? <p className="rc-small mt-6">Reading the registry…</p> : null}
        {!loading && list.length === 0 ? <p className="rc-small mt-6">No entries yet.</p> : null}
        <ul className="m-0 mt-6 grid list-none gap-4 p-0" data-testid="registry-list">
          {list.map((e) => {
            const own = address && e.registrant.toLowerCase() === address.toLowerCase();
            const done = e.mine && e.mine.stance !== 0;
            return (
              <li key={e.id} className="rc-card p-5" data-testid="registry-entry">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="rc-label m-0" style={{ fontSize: 10 }}>
                      #{e.id} · {kindLabel(e.kind)}
                    </p>
                    <p className="m-0 mt-1 font-display text-[18px] font-semibold text-ink">{e.label}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rc-pill lime">{e.attestCount} attest</span>
                    <span className={`rc-pill ${e.flagCount ? "coral" : ""}`}>{e.flagCount} flag</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-1 font-mono text-[12px] text-soft">
                    <span>
                      Source{" "}
                      <a className="rc-link" href={explorerAddress(e.source)} target="_blank" rel="noreferrer">
                        {shortAddress(e.source, 8, 6)}
                      </a>
                    </span>
                    <span className="break-all">
                      Rules{" "}
                      <a className="rc-link" href={e.rulesUrl} target="_blank" rel="noreferrer nofollow ugc">
                        {e.rulesUrl}
                      </a>
                    </span>
                    <span className="break-all">Rules hash {shortAddress(e.rulesHash, 10, 8)}</span>
                    <span>Registered by {shortAddress(e.registrant)}</span>
                  </div>
                  <SourceFacts address={e.source} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  {own ? (
                    <span className="rc-note">You registered this entry; other wallets attest or flag it.</span>
                  ) : done ? (
                    <span className="rc-note">You {e.mine!.stance === 1 ? "attested" : `flagged (${REASONS.find((r) => r.code === e.mine!.reason)?.label ?? "reason"})`} this entry.</span>
                  ) : (
                    <>
                      <button type="button" className="rc-btn lime" disabled={busy} onClick={() => respond(e.id, 1)} data-testid="attest-btn">
                        Rules match the contract
                      </button>
                      <select className="rc-select !w-auto" value={reason[e.id] ?? 0} onChange={(ev) => setReason((m) => ({ ...m, [e.id]: Number(ev.target.value) }))} aria-label="Flag reason">
                        <option value={0}>Flag reason…</option>
                        {REASONS.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="rc-btn ghost" disabled={busy} onClick={() => respond(e.id, 2)} data-testid="flag-btn">
                        Flag
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="rc-note mt-6">Flags are counted and shown; the contract never hides an entry and has no admin who could. Read both counts, then open the rules and the code yourself.</p>
      </div>

      <div className="rc-card h-fit p-6" data-testid="register-form">
        <span className="rc-label">Register a source</span>
        <div className="mt-4 grid gap-3">
          <label className="rc-field">
            <span className="rc-label" style={{ fontSize: 10 }}>
              Source contract
            </span>
            <input className="rc-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="0x…" spellCheck={false} data-testid="reg-source" />
          </label>
          <label className="rc-field">
            <span className="rc-label" style={{ fontSize: 10 }}>
              Kind
            </span>
            <select className="rc-select" value={form.kind} onChange={(e) => setForm({ ...form, kind: Number(e.target.value) })} data-testid="reg-kind">
              {KINDS.map((k) => (
                <option key={k.code} value={k.code}>
                  {k.label}
                </option>
              ))}
            </select>
            <span className="rc-note">Read path: {KINDS.find((k) => k.code === form.kind)?.read}</span>
          </label>
          <label className="rc-field">
            <span className="rc-label" style={{ fontSize: 10 }}>
              Label (1–48 plain characters)
            </span>
            <input className="rc-input" value={form.label} maxLength={48} onChange={(e) => setForm({ ...form, label: e.target.value })} data-testid="reg-label" />
          </label>
          <label className="rc-field">
            <span className="rc-label" style={{ fontSize: 10 }}>
              Rules link (https)
            </span>
            <input className="rc-input" value={form.rulesUrl} onChange={(e) => setForm({ ...form, rulesUrl: e.target.value })} spellCheck={false} data-testid="reg-url" />
          </label>
          <label className="rc-field">
            <span className="rc-label" style={{ fontSize: 10 }}>
              Rules text as published (or its keccak256 hash)
            </span>
            <textarea className="rc-textarea !min-h-[100px]" value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} data-testid="reg-rules" />
            <span className="rc-note break-all">Hash: {rulesHashOf(form.rules) ?? "—"}</span>
          </label>
          <button type="button" className="rc-btn lime" disabled={busy} onClick={register} data-testid="reg-go">
            {busy ? "Waiting for the wallet…" : address ? (live ? "Register on chain" : "Sign and save (practice)") : "Connect a wallet"}
          </button>
          <p className="rc-note">
            {live ? `Network gas only: register ${cost(GAS.register)}, attest ${cost(GAS.attest)}, flag ${cost(GAS.flag)} on ${CHAIN.name}.` : "Practice mode: a signature, no gas."} One entry per wallet per source. Registering says nothing about whether a claim is safe.
          </p>
        </div>
      </div>
    </div>
  );
}
