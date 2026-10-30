"use client";

import Link from "next/link";
import { useState } from "react";
import { explorerAddress, shortAddress } from "@/config/brand";
import { ArrowRight, ArrowUpRight } from "@/components/site/Icons";
import { formatUnits, simulateHref, type ClaimRow, type ClaimStatus } from "@/lib/claims";

const PILL: Record<ClaimStatus, { cls: string; text: string }> = {
  claimable: { cls: "lime", text: "Claimable" },
  locked: { cls: "amber", text: "Not yet" },
  claimed: { cls: "", text: "Already claimed" },
  empty: { cls: "", text: "Nothing here" },
  unreadable: { cls: "coral", text: "Not readable" },
};

export function StatusPill({ status }: { status: ClaimStatus }) {
  const p = PILL[status];
  return (
    <span className={`rc-pill ${p.cls}`}>
      <span className="sq" /> {p.text}
    </span>
  );
}

const when = (t?: number) => (t ? new Date(t * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC" : null);

/** Result rows of a claim check: amount, why, source link and the simulate button. `pageSize` shows them in pages. */
export function ClaimRows({ rows, account, pageSize }: { rows: ClaimRow[]; account: string; pageSize?: number }) {
  const [shown, setShown] = useState(pageSize ?? Infinity);
  if (rows.length === 0) return null;
  const visible = rows.slice(0, shown);
  const left = rows.length - visible.length;
  return (
    <>
      <ul className="m-0 grid list-none gap-0 p-0" data-testid="claim-rows">
        {visible.map((r) => (
          <li key={r.id} className="border-b border-line py-6 first:border-t" data-testid={`row-${r.status}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="rc-label m-0" style={{ fontSize: 10 }}>
                  {r.sourceName}
                </p>
                <p className="m-0 mt-1 font-display text-[18px] font-semibold text-ink">{r.title}</p>
              </div>
              <StatusPill status={r.status} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-start">
              <p className="m-0 font-mono text-[20px] text-ink" data-testid="row-amount">
                {r.status === "unreadable" ? "—" : `${formatUnits(r.amount, r.token.decimals)} ${r.token.symbol}`}
              </p>
              <div className="min-w-0">
                <p className="rc-small m-0">{r.why}</p>
                <p className="rc-note m-0 mt-2">
                  Source{" "}
                  <a className="rc-link" href={explorerAddress(r.source)} target="_blank" rel="noreferrer">
                    {shortAddress(r.source)}
                  </a>
                  {r.unlockAt ? ` · unlocks ${when(r.unlockAt)}` : ""}
                  {r.link ? (
                    <>
                      {" · "}
                      <a className="rc-link" href={r.link.href} target="_blank" rel="noreferrer">
                        {r.link.label} <ArrowUpRight size={10} />
                      </a>
                    </>
                  ) : null}
                  {r.action ? ` · call ${r.action.label}` : ""}
                </p>
              </div>
              {r.action ? (
                <Link href={simulateHref(r, account)} className="rc-btn lime" data-testid="simulate-link">
                  Simulate claim <ArrowRight size={13} className="arrow" />
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {left > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="button" className="rc-btn line" onClick={() => setShown((n) => n + (pageSize ?? left))} data-testid="rows-more">
            Show {Math.min(left, pageSize ?? left)} more
          </button>
          <span className="rc-note">
            {visible.length} of {rows.length} shown
          </span>
        </div>
      ) : null}
    </>
  );
}
