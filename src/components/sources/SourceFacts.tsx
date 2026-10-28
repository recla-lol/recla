"use client";

import { useEffect, useState } from "react";
import { CHAIN } from "@/config/brand";

type Facts = { hasCode: boolean | null; codeSize: number | null; verified: "full" | "partial" | "unknown"; contractName: string | null };

/** Live verification facts for one contract: code on chain now + verified source on Sourcify. */
export function SourceFacts({ address }: { address: string }) {
  const [f, setF] = useState<Facts | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch(`/api/source?address=${address}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setF)
      .catch(() => setErr(true));
  }, [address]);
  const row = (k: string, v: React.ReactNode, tone = "") => (
    <div className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
      <dt className="rc-label" style={{ fontSize: 10 }}>
        {k}
      </dt>
      <dd className={`m-0 text-right font-mono text-[12px] ${tone}`}>{v}</dd>
    </div>
  );
  if (err) return <p className="rc-note">Verification facts could not be read just now.</p>;
  return (
    <dl className="m-0" data-testid="source-facts">
      {row("Has code", f === null ? "reading…" : f.hasCode === null ? "—" : f.hasCode ? `yes, ${f.codeSize?.toLocaleString("en-US")} bytes` : "no", f?.hasCode ? "rc-ok" : f?.hasCode === false ? "text-coral" : "")}
      {row(
        "Verified source",
        f === null ? "reading…" : f.verified === "full" ? `exact match${f.contractName ? ` · ${f.contractName}` : ""}` : f.verified === "partial" ? `match${f.contractName ? ` · ${f.contractName}` : ""}` : "unknown",
        f?.verified && f.verified !== "unknown" ? "rc-ok" : "",
      )}
      <p className="rc-note m-0 mt-2">Code read on {CHAIN.name} now; verified source from Sourcify. &quot;Unknown&quot; means not found there, not that the code is unverified elsewhere.</p>
    </dl>
  );
}
