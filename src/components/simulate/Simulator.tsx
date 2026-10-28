"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { encodeFunctionData, getAddress, type Abi, type Hex } from "viem";
import { CHAIN, explorerAddress, explorerTx, shortAddress } from "@/config/brand";
import { registryLive } from "@/config/contracts";
import { ArrowUpRight } from "@/components/site/Icons";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { ESCROW_ABI, LOCKER_ABI, REFUND_ABI, VESTING_ABI } from "@/lib/abi";
import { ETH, formatUnits, tokenInfo, type TokenInfo } from "@/lib/claims";
import { explain, waitForReceipt } from "@/lib/client";
import { describeCall, isBuiltInSource, selectorVerdict, signGate } from "@/lib/gate";
import { read } from "@/lib/client";
import { REGISTRY_ABI } from "@/lib/abi";
import { CONTRACTS } from "@/config/contracts";
import { balanceNow, calldataProblem, returnedAmount, simulate, type SimResult } from "@/lib/simulate";

const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

const PRESETS = [
  { key: "claim", label: "claim()", build: () => encodeFunctionData({ abi: ESCROW_ABI as Abi, functionName: "claim", args: [] } as never) },
  { key: "withdraw", label: "withdraw(lock id)", arg: "Lock id", build: (a: string) => encodeFunctionData({ abi: LOCKER_ABI as Abi, functionName: "withdraw", args: [BigInt(a || "0")] } as never) },
  { key: "release", label: "release()", build: () => encodeFunctionData({ abi: VESTING_ABI as Abi, functionName: "release", args: [] } as never) },
  { key: "releaseToken", label: "release(token)", arg: "Token address", build: (a: string) => encodeFunctionData({ abi: VESTING_ABI as Abi, functionName: "release", args: [a] } as never) },
  { key: "claimToken", label: "claimToken(token)", arg: "Token address", build: (a: string) => encodeFunctionData({ abi: ESCROW_ABI as Abi, functionName: "claimToken", args: [a] } as never) },
  { key: "claimRefund", label: "claimRefund()", build: () => encodeFunctionData({ abi: REFUND_ABI as Abi, functionName: "claimRefund", args: [] } as never) },
  { key: "custom", label: "Custom calldata", arg: "Calldata (0x…)", build: (a: string) => a },
] as const;

/** Claim Simulator: dry-run the exact claim from the claimer's address, then (only if the user wants) sign it. */
export function Simulator() {
  const q = useSearchParams();
  const { address, onRobinhoodChain, sendTransaction, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const fromLink = q.get("to") && q.get("data");
  const [to, setTo] = useState(q.get("to") ?? "");
  const [from, setFrom] = useState(q.get("from") ?? "");
  const [preset, setPreset] = useState<string>(fromLink ? "custom" : "claim");
  const [arg, setArg] = useState(q.get("data") ?? "");
  const [res, setRes] = useState<SimResult | null>(null);
  const [before, setBefore] = useState<bigint | null>(null);
  const [token, setToken] = useState<TokenInfo>(ETH);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<{ hash: string; ok: boolean | null; after: bigint | null } | null>(null);
  // Whether the target is in the source registry (read on chain; false while the registry is not deployed).
  const [registered, setRegistered] = useState(false);
  const [ran, setRan] = useState<{ to: string; data: Hex } | null>(null);

  useEffect(() => {
    // Only a token ADDRESS is taken from a link; its symbol and decimals are read from the token contract.
    const t = q.get("token");
    if (t && isAddr(t)) void tokenInfo(t).then(setToken);
  }, [q]);

  const p = PRESETS.find((x) => x.key === preset) ?? PRESETS[0];
  const who = (from || address || "").trim();

  function calldata(): Hex | null {
    try {
      if ("arg" in p && p.key !== "custom" && p.key !== "withdraw" && !isAddr(arg.trim())) {
        setErr(`${p.arg} must be a 0x address.`);
        return null;
      }
      if (p.key === "withdraw" && !/^[0-9]+$/.test(arg.trim())) {
        setErr("The lock id is a whole number.");
        return null;
      }
      const d = p.build(arg.trim()) as Hex;
      const bad = calldataProblem(d);
      if (bad) {
        setErr(bad);
        return null;
      }
      return d;
    } catch {
      setErr("Could not build the calldata from that input.");
      return null;
    }
  }

  async function run() {
    setErr(null);
    setRes(null);
    setSent(null);
    if (!isAddr(to.trim())) return setErr("Paste the source contract address (0x…).");
    if (!isAddr(who)) return setErr("Paste the claimer's address, or connect a wallet.");
    const data = calldata();
    if (!data) return;
    setBusy(true);
    try {
      const f = getAddress(who);
      const target = getAddress(to.trim());
      const [r, b, reg] = await Promise.all([
        simulate({ from: f, to: target, data }),
        balanceNow(f, token),
        isBuiltInSource(target) || !registryLive()
          ? Promise.resolve(false)
          : read<bigint>({ to: CONTRACTS.registry, abi: REGISTRY_ABI as Abi, fn: "entryCountForSource", args: [target] }).then((n) => n > 0n).catch(() => false),
      ]);
      setRes(r);
      setBefore(b);
      setRegistered(reg);
      setRan({ to: target, data });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The simulation failed.");
    } finally {
      setBusy(false);
    }
  }

  // A shared link from the claim check starts the dry run once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one automatic run for a prepared link
    if (fromLink && isAddr(q.get("from") ?? "")) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const got = res?.ok ? returnedAmount(res.returned) : null;
  const mine = address && isAddr(who) && address.toLowerCase() === who.toLowerCase();
  // The gate is decided on exactly the call that was simulated.
  const gate = ran ? signGate(ran.data, ran.to, registered) : null;
  const decoded = ran ? describeCall(ran.data) : null;
  const verdict = ran ? selectorVerdict(ran.data) : null;

  async function sign() {
    if (!ran || !res?.ok) return;
    // Checked again at the moment of signing: nothing outside the gate ever reaches the wallet.
    const g = signGate(ran.data, ran.to, registered);
    if (!g.ok) return setErr(g.reason);
    setErr(null);
    try {
      const hash = await sendTransaction({ to: ran.to, data: ran.data });
      setSent({ hash, ok: null, after: null });
      const r = await waitForReceipt(hash, 180_000);
      const after = await balanceNow(getAddress(who), token);
      setSent({ hash, ok: r.ok, after });
    } catch (e) {
      setErr(explain(e));
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="rc-card p-6" data-testid="simulator">
        {fromLink ? (
          <div className="rc-alert mb-5" data-testid="sim-link-warning">
            This call came from a link. {CHAIN.name} contracts are real, but this page did not build the call: read the decoded call under the result before anything else. Signing is offered only for the claim calls Recla builds, on a built-in or registered source.
          </div>
        ) : null}
        <div className="grid gap-4">
          <label className="rc-field">
            <span className="rc-label">Source contract</span>
            <input className="rc-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" spellCheck={false} data-testid="sim-to" />
          </label>
          <label className="rc-field">
            <span className="rc-label">Claimer address (empty = connected wallet)</span>
            <input className="rc-input" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={address ?? "0x…"} spellCheck={false} data-testid="sim-from" />
          </label>
          <label className="rc-field">
            <span className="rc-label">Claim call</span>
            <select className="rc-select" value={preset} onChange={(e) => setPreset(e.target.value)} data-testid="sim-preset">
              {PRESETS.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          {"arg" in p ? (
            <label className="rc-field">
              <span className="rc-label">{p.arg}</span>
              {p.key === "custom" ? (
                <textarea className="rc-textarea !min-h-[90px]" value={arg} onChange={(e) => setArg(e.target.value)} spellCheck={false} data-testid="sim-data" />
              ) : (
                <input className="rc-input" value={arg} onChange={(e) => setArg(e.target.value)} spellCheck={false} />
              )}
            </label>
          ) : null}
          <button type="button" className="rc-btn lime lg w-fit" onClick={run} disabled={busy} data-testid="sim-go">
            {busy ? "Simulating…" : "Run the simulation"}
          </button>
          {err ? <p className="rc-err" data-testid="sim-err">{err}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rc-card p-6" data-testid="sim-result">
          <span className="rc-label">Result</span>
          {!res ? (
            <p className="rc-small mt-4">Nothing simulated yet. The dry run executes the call on {CHAIN.name} from the claimer&apos;s address against the latest block; nothing is signed or sent.</p>
          ) : (
            <>
              <p className={`mt-4 font-display text-[24px] font-semibold ${res.ok ? "text-lime" : "text-coral"}`} data-testid="sim-verdict">
                {res.ok ? "Would succeed" : "Would revert"}
              </p>
              <p className="rc-small mt-2">{res.ok ? `The contract accepted the call${res.gas ? ` (about ${res.gas.toLocaleString("en-US")} gas)` : ""}.` : res.reason}</p>
              <dl className="m-0 mt-5 grid gap-3 font-mono text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Balance now</dt>
                  <dd className="m-0 text-ink">{before === null ? "—" : `${formatUnits(before, token.decimals)} ${token.symbol}`}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Expected to arrive</dt>
                  <dd className="m-0 text-ink">{got === null ? "—" : `${formatUnits(got, token.decimals)} ${token.symbol}`}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Expected after</dt>
                  <dd className="m-0 text-ink">{before === null || got === null ? "—" : `${formatUnits(before + got, token.decimals)} ${token.symbol}`}</dd>
                </div>
              </dl>
              <div className="mt-5 border-t border-line pt-4" data-testid="sim-decoded">
                <span className="rc-label" style={{ fontSize: 10 }}>
                  Decoded call
                </span>
                <p className="m-0 mt-1 font-mono text-[12px] break-all text-ink">{decoded ?? `unknown call, selector ${verdict?.selector ?? "—"}`}</p>
                <p className="m-0 mt-1 font-mono text-[11px] break-all text-muted">to {ran?.to}</p>
                {verdict?.kind === "blocked" ? <p className="rc-err mt-2 text-[13px]">{verdict.reason}</p> : null}
              </div>
              <p className="rc-note mt-4">
                Block {res.blockNumber?.toLocaleString("en-US") ?? "—"} · source{" "}
                <a className="rc-link" href={explorerAddress(to.trim())} target="_blank" rel="noreferrer">
                  {shortAddress(to.trim())}
                </a>
                {token.symbol === "ETH" ? " · gas is paid on top in ETH" : ""}. The amount is what the source states or returns; the network fee is separate.
              </p>
            </>
          )}
        </div>
        {res?.ok && gate && !gate.ok ? (
          <div className="rc-card p-6" data-testid="sim-gate">
            <span className="rc-label">Not offered for signing</span>
            <p className="rc-small mt-3">{gate.reason}</p>
          </div>
        ) : null}
        {res?.ok && gate?.ok ? (
          <div className="rc-card p-6">
            <span className="rc-label">Claim it yourself</span>
            <p className="rc-small mt-3">Your wallet will show this exact call: {gate.signature} to {shortAddress(ran!.to)}. No approval, no fee to anyone but the network.</p>
            {!address ? (
              <button type="button" className="rc-btn line mt-4" onClick={open}>
                Connect the claimer&apos;s wallet
              </button>
            ) : !mine ? (
              <p className="rc-small mt-4 text-amber">The connected wallet is not the claimer. Only the claimer&apos;s own wallet can sign this.</p>
            ) : !onRobinhoodChain ? (
              <button type="button" className="rc-btn line mt-4" onClick={switchNetwork}>
                Switch to {CHAIN.name}
              </button>
            ) : (
              <button type="button" className="rc-btn lime mt-4" onClick={sign} data-testid="sim-sign">
                Sign in my wallet
              </button>
            )}
            {sent ? (
              <p className="rc-small mt-4" data-testid="sim-sent">
                {sent.ok === null ? "Sent, waiting for the receipt… " : sent.ok ? "Confirmed. " : "The transaction reverted on chain. "}
                <a className="rc-link" href={explorerTx(sent.hash)} target="_blank" rel="noreferrer">
                  View on explorer <ArrowUpRight size={11} />
                </a>
                {sent.after !== null ? ` Balance now ${formatUnits(sent.after, token.decimals)} ${token.symbol}.` : ""}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
