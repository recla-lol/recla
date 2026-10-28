"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { explorerAddress, shortAddress } from "@/config/brand";
import { registryLive } from "@/config/contracts";
import { HOODLOCK, PONS_ESCROW, kindLabel } from "@/config/sources";
import { latestEntries, type Entry } from "@/lib/registry";

/** Left box of the "live" section: the newest registry entries, or the built-in sources before deployment. */
export function RegistryFeed() {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!registryLive()) return;
    latestEntries(6)
      .then((r) => setRows(r.rows))
      .catch(() => setErr(true));
  }, []);
  const builtIn = [
    { label: PONS_ESCROW.name, address: PONS_ESCROW.address, kind: "Fee escrow · built in" },
    { label: HOODLOCK.name, address: HOODLOCK.address, kind: "Token locks · built in" },
  ];
  return (
    <div className="rc-card soft flex min-h-[380px] flex-col p-6" data-testid="registry-feed">
      <span className="rc-label">{registryLive() ? "Newest registry entries" : "Sources read today"}</span>
      <ul className="m-0 mt-5 flex list-none flex-col gap-0 p-0">
        {builtIn.map((b) => (
          <li key={b.address} className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div className="min-w-0">
              <p className="m-0 text-[15px] text-ink">{b.label}</p>
              <p className="rc-note m-0 mt-1">{b.kind}</p>
            </div>
            <a className="rc-link shrink-0 font-mono text-[12px]" href={explorerAddress(b.address)} target="_blank" rel="noreferrer">
              {shortAddress(b.address)}
            </a>
          </li>
        ))}
        {rows?.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div className="min-w-0">
              <p className="m-0 truncate text-[15px] text-ink">{r.label}</p>
              <p className="rc-note m-0 mt-1">
                #{r.id} · {kindLabel(r.kind)} · {r.attestCount} attest · {r.flagCount} flag
              </p>
            </div>
            <a className="rc-link shrink-0 font-mono text-[12px]" href={explorerAddress(r.source)} target="_blank" rel="noreferrer">
              {shortAddress(r.source)}
            </a>
          </li>
        ))}
      </ul>
      <p className="rc-small mt-auto pt-5 text-muted">
        {!registryLive()
          ? "The registry contract is not deployed yet, so community entries start the day it is. Until then you can practise registering in your browser."
          : err
            ? "The registry did not answer just now."
            : rows && rows.length === 0
              ? "No community entries yet. Be the first to register a source."
              : "Entries are read from the registry contract, newest first."}{" "}
        <Link href="/registry" className="rc-link">
          Open the registry
        </Link>
      </p>
    </div>
  );
}
