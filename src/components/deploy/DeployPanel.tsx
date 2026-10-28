"use client";

import { useMemo, useState } from "react";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CHAIN, explorerAddress, explorerTx } from "@/config/brand";
import { storageKey } from "@/config/storage";
import { explain, waitForReceipt } from "@/lib/client";

type Art = { creation: string; sha256: string };
type Progress = { registry?: string; registryTx?: string; registryBlock?: number };

/** Owner tool: deploys ReclaSourceRegistry from the connected wallet. */
export function DeployPanel({ registry }: { registry: Art }) {
  const { address, onRobinhoodChain, sendTransaction, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const [p, setP] = useLocalStore<Progress>(storageKey("deploy", String(CHAIN.id)), {});
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const say = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${s}`, ...l]);

  const snippet = useMemo(() => `const DEPLOYED = {\n  registry: "${p.registry ?? ""}",\n  registryBlock: ${p.registryBlock ?? 0},\n};`, [p]);

  async function deploy() {
    setBusy(true);
    try {
      const data = registry.creation as `0x${string}`;
      say(`ReclaSourceRegistry: confirm in the wallet (${(data.length - 2) / 2} bytes)`);
      const hash = await sendTransaction({ data });
      say(`ReclaSourceRegistry: sent ${hash}`);
      const r = await waitForReceipt(hash, 300_000);
      if (!r.ok || !r.contractAddress) throw new Error("ReclaSourceRegistry deployment reverted");
      say(`ReclaSourceRegistry: deployed at ${r.contractAddress} (block ${r.blockNumber})`);
      setP({ registry: r.contractAddress, registryTx: hash, registryBlock: r.blockNumber });
    } catch (e) {
      say(`failed: ${explain(e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!address)
    return (
      <button type="button" className="rc-btn lime w-fit" onClick={open}>
        Connect the deployer wallet
      </button>
    );
  if (!onRobinhoodChain)
    return (
      <button type="button" className="rc-btn lime w-fit" onClick={switchNetwork}>
        Switch to {CHAIN.name}
      </button>
    );

  return (
    <div className="flex flex-col gap-4" data-testid="deploy-panel">
      <section className="rc-card p-6 flex min-w-0 flex-col gap-3">
        <h2 className="font-mono text-[16px] font-medium">1 · ReclaSourceRegistry (no arguments, no token)</h2>
        <p className="m-0 font-mono text-[12px] text-muted">Build sha256 {registry.sha256.slice(0, 16)}…</p>
        {p.registry ? (
          <p className="m-0 text-[14px]">
            Deployed at{" "}
            <a href={explorerAddress(p.registry)} target="_blank" rel="noreferrer" className="font-mono text-lime underline">
              {p.registry}
            </a>{" "}
            (block {p.registryBlock},{" "}
            <a className="text-lime underline" href={explorerTx(p.registryTx ?? "")} target="_blank" rel="noreferrer">
              tx
            </a>
            )
          </p>
        ) : (
          <button type="button" className="rc-btn lime w-fit" disabled={busy} data-testid="deploy-registry" onClick={deploy}>
            {busy ? "Deploying…" : "Deploy ReclaSourceRegistry"}
          </button>
        )}
      </section>

      <section className="rc-card p-6 flex min-w-0 flex-col gap-3">
        <h2 className="font-mono text-[16px] font-medium">2 · Paste into src/config/contracts.ts</h2>
        <pre className="max-w-full overflow-x-auto rc-code font-mono text-[12.5px]" data-testid="deploy-snippet">
          {snippet}
        </pre>
        <p className="m-0 text-[13px] text-muted">
          Then run <code>npm run verify-deployment -- --registry {p.registry ?? "0x…"} --registry-tx {p.registryTx ?? "0x…"}</code>, verify the source on the explorer (the project&apos;s explorer kit), and remove this page.
        </p>
      </section>

      {log.length ? (
        <ul className="flex flex-col gap-1 font-mono text-[12px] text-muted" data-testid="deploy-log">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
