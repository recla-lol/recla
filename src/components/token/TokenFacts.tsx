"use client";

import { BRAND, TOKEN, buyUrl, chartUrl, explorerToken } from "@/config/brand";
import { CaButton } from "@/components/site/CaCopy";
import { ArrowUpRight } from "@/components/site/Icons";
import { useChain } from "@/components/providers/ChainProvider";

const usd = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 8 : 2 })}`);

/** Token facts read on chain after launch (name, symbol, supply) plus keyless market data; "—" before. */
export function TokenFacts() {
  const { facts } = useChain();
  const t = facts?.token;
  const m = facts?.market;
  const supply = t?.supply && t.decimals !== null ? (BigInt(t.supply) / 10n ** BigInt(t.decimals)).toLocaleString("en-US") : null;
  const rows = [
    ["Contract", TOKEN.isLive ? BRAND.ca : "Not published (not launched)"],
    ["Name / symbol (on chain)", t ? `${t.name ?? "—"} / ${t.symbol ?? "—"}` : "—"],
    ["Total supply (on chain)", supply ?? "—"],
    ["Price", usd(m?.priceUsd)],
    ["Liquidity", usd(m?.liquidityUsd)],
    ["Volume 24h", usd(m?.volume24hUsd)],
  ];
  const chart = chartUrl(BRAND.ca);
  return (
    <div className="rc-card p-6" data-testid="token-facts">
      <dl className="m-0">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-3 border-b border-line py-3 last:border-0">
            <dt className="rc-label" style={{ fontSize: 10 }}>
              {k}
            </dt>
            <dd className="m-0 font-mono text-[13px] break-all text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        <a className="rc-btn lime" href={buyUrl()} target="_blank" rel="noreferrer">
          {TOKEN.isLive ? `Buy ${BRAND.symbol} on Pons` : `Pons launchpad · ${BRAND.symbol} at launch`} <ArrowUpRight size={13} />
        </a>
        <CaButton className="rc-btn ghost" />
        {chart ? (
          <a className="rc-btn line" href={chart} target="_blank" rel="noreferrer">
            Chart on DEXTools <ArrowUpRight size={13} />
          </a>
        ) : null}
        {TOKEN.isLive ? (
          <a className="rc-btn line" href={explorerToken(BRAND.ca)} target="_blank" rel="noreferrer">
            Explorer <ArrowUpRight size={13} />
          </a>
        ) : null}
      </div>
      <p className="rc-note mt-4">Name, symbol and supply are read from the token contract; price, liquidity and volume from GeckoTerminal (network &quot;robinhood&quot;) once the token trades.</p>
    </div>
  );
}
