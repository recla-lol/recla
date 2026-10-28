"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BRAND, TOKEN } from "@/config/brand";
import { CaButton } from "@/components/site/CaCopy";
import { ArrowRight, SearchIcon } from "@/components/site/Icons";
import { useWallet } from "@/components/wallet/WalletProvider";

/** Top band: paste any address (or use the connected wallet) and jump to the claim check. */
export function ClaimBand() {
  const { address } = useWallet();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const go = () => {
    const v = (value || address || "").trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(v)) {
      setErr("Paste a 0x address (42 characters) or connect a wallet.");
      return;
    }
    router.push(`/check?address=${v}`);
  };
  return (
    <section className="rc-band" aria-label="Claim check">
      <div className="rc-wrap">
        <div className="head">
          <span className="rc-eyebrow inline-flex items-center gap-2" style={{ fontSize: 10, letterSpacing: "0.26em" }}>
            <SearchIcon size={13} /> Claim check
          </span>
          <span className="rc-pill hatch">Read only</span>
          <Link href="/history" className="rc-mono inline-flex items-center gap-2 text-soft no-underline" style={{ fontSize: 10 }}>
            Claim history <ArrowRight size={12} />
          </Link>
          <span className="ml-auto hidden md:inline-flex">
            <CaButton className="rc-btn ghost mono" />
          </span>
        </div>
        <form
          className="grid"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <label className="rc-field">
            <span className="rc-label" style={{ fontSize: 9 }}>
              Wallet address on {BRAND.chainName}
            </span>
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setErr(null);
              }}
              placeholder={address ?? "0x…"}
              spellCheck={false}
              autoComplete="off"
              aria-label="Wallet address"
              data-testid="band-input"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rc-btn lime" data-testid="band-go">
              Check claims <ArrowRight size={14} className="arrow" />
            </button>
            <Link href="/simulate" className="rc-btn line">
              Simulate a claim
            </Link>
          </div>
        </form>
        <p className="rc-note mt-4">{err ?? `Reading is free and needs no signature. ${BRAND.name} never sends a claim: your own wallet signs it, after a simulation.${TOKEN.isLive ? "" : ` ${BRAND.symbol} is not launched yet.`}`}</p>
      </div>
    </section>
  );
}
