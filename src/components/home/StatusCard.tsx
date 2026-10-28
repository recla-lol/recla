"use client";

import { useEffect, useState } from "react";
import { BRAND, CHAIN, TOKEN, explorerToken } from "@/config/brand";
import { registryLive } from "@/config/contracts";
import { useChain } from "@/components/providers/ChainProvider";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts after mount (no server time in HTML)
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/** Project status card: launch state, official address, registry state, a live chain clock. */
export function StatusCard() {
  const { facts, failed } = useChain();
  const now = useClock();
  const utc = now ? now.toISOString().slice(11, 19) : "--:--:--";
  return (
    <div className="rc-card p-6 md:p-6" data-testid="status-card">
      <div className="flex items-center justify-between gap-3">
        <span className="rc-label" style={{ letterSpacing: "0.22em" }}>
          Project status
        </span>
        <span className={`rc-pill ${TOKEN.isLive ? "lime" : ""}`}>
          <span className="sq" /> {TOKEN.isLive ? "Live" : "Pre-launch"}
        </span>
      </div>
      <p className="rc-small mt-5">
        {TOKEN.isLive
          ? `${BRAND.symbol} is live on Pons. The address below is the only one.`
          : `${BRAND.symbol} is not out yet. Until it exists, nothing here can be copied or bought; the claim tools work without it.`}
      </p>
      <dl className="rc-dl m-0">
        <dt className="rc-label">Token contract</dt>
        <dd className="font-mono text-[14px] break-all text-ink">
          {TOKEN.isLive ? (
            <a className="rc-link" href={explorerToken(BRAND.ca)} target="_blank" rel="noreferrer">
              {BRAND.ca}
            </a>
          ) : (
            "Not out yet"
          )}
        </dd>
        <dt className="rc-label">Source registry</dt>
        <dd className="rc-small">{registryLive() ? "Deployed on Robinhood Chain; entries are read live." : "Written and tested, not deployed yet. Registering runs in practice mode until it is."}</dd>
        <dt className="rc-label">Chain clock</dt>
        <dd className="font-mono text-[18px] leading-7 text-ink" data-testid="chain-clock">
          {utc} UTC
          <span className="ml-3 text-[13px] text-muted">{facts?.block ? `block ${facts.block.toLocaleString("en-US")}` : failed ? "chain not reachable" : "reading…"}</span>
        </dd>
      </dl>
      <p className="rc-small mt-6 border-t border-line pt-4 text-muted">
        No claim button on this site sends anything by itself. Every claim is a transaction your wallet shows you first, and only after {BRAND.name} has simulated it on {CHAIN.name}.
      </p>
    </div>
  );
}
