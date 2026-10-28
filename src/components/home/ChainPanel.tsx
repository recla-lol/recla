"use client";

import { CHAIN } from "@/config/brand";
import { useChain } from "@/components/providers/ChainProvider";

const fmt = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }));

/** Live facts from Robinhood Chain, refreshed every few seconds. */
export function ChainPanel() {
  const { facts, failed } = useChain();
  const rows = [
    { k: "Latest block", v: fmt(facts?.block) },
    { k: "Block pace", v: facts?.blockPace ? `${fmt(facts.blockPace, 2)} s` : "—" },
    { k: "Gas price", v: facts?.gasGwei !== null && facts?.gasGwei !== undefined ? `${fmt(facts.gasGwei, 4)} gwei` : "—" },
    { k: "ETH / USD", v: facts?.ethUsd ? `$${fmt(facts.ethUsd, 2)}` : "—" },
  ];
  return (
    <dl className="m-0 grid grid-cols-2 gap-px border border-line bg-[rgba(197,201,204,0.15)] md:grid-cols-4" data-testid="chain-panel">
      {rows.map((r) => (
        <div key={r.k} className="bg-bg p-4">
          <dt className="rc-label" style={{ fontSize: 10 }}>
            {r.k}
          </dt>
          <dd className="m-0 mt-2 font-mono text-[18px] text-ink">{r.v}</dd>
        </div>
      ))}
      <p className="rc-note col-span-full m-0 bg-bg px-4 py-3">
        {failed ? `${CHAIN.name} did not answer just now; numbers return on the next read.` : `Read from ${CHAIN.name} (chain ${CHAIN.id}); ETH / USD from the Chainlink feed on chain.`}
      </p>
    </dl>
  );
}
