"use client";

import { useState } from "react";
import { BRAND, TOKEN, isAddress, shortAddress } from "@/config/brand";
import { CheckIcon, CopyIcon } from "@/components/site/Icons";

/* Copy CA: one component family, one source (BRAND.ca). Before launch it says "At launch" and copies nothing. */

export function useCopy(value: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused; the text stays visible.
    }
  };
  return { copied, copy };
}

/** Navbar / footer button: copies the CA once it is real; before that it is disabled and says "CA at launch". */
export function CaButton({ className = "" }: { className?: string }) {
  const { copied, copy } = useCopy(BRAND.ca);
  const live = TOKEN.isLive;
  return (
    <button type="button" className={`rc-btn ${className}`} onClick={copy} disabled={!live} data-testid="ca-btn" title={live ? `Copy the ${BRAND.symbol} contract address` : "The contract address is published at launch"}>
      {live ? (copied ? <><CheckIcon size={14} /> Copied</> : "Copy CA") : "CA at launch"}
    </button>
  );
}

/** Any address or hash as a copy chip. Empty value => `empty` text. */
export function AddressChip({ value, empty = "Not deployed yet", head = 6, tail = 4 }: { value: string; empty?: string; head?: number; tail?: number }) {
  const { copied, copy } = useCopy(value);
  const ok = isAddress(value) || /^0x[0-9a-fA-F]{64}$/.test(value);
  return (
    <button type="button" className="rc-linkbtn inline-flex items-center gap-1 font-mono" onClick={copy} disabled={!ok} title={ok ? "Copy" : empty}>
      {ok ? shortAddress(value, head, tail) : empty}
      {ok ? copied ? <CheckIcon size={12} /> : <CopyIcon size={12} /> : null}
    </button>
  );
}

/** "Copy" button for a command line. */
export function CopyText({ value, label = "Copy" }: { value: string; label?: string }) {
  const { copied, copy } = useCopy(value);
  return (
    <button type="button" onClick={copy}>
      {copied ? "Copied" : label}
    </button>
  );
}
