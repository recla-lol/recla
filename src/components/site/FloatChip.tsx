"use client";

import { useEffect, useState } from "react";
import { BRAND, TOKEN, buyUrl } from "@/config/brand";
import { storageKey } from "@/config/storage";
import { CloseIcon } from "@/components/site/Icons";

const KEY = storageKey("float", "hidden");

/** Small dismissible chip, bottom left: the one place to buy, remembered closed per browser. */
export function FloatChip() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let v = false;
    try {
      v = localStorage.getItem(KEY) === "1";
    } catch {
      // storage blocked: show it
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount (storage is client-only)
    setHidden(v);
  }, []);
  if (hidden) return null;
  return (
    <div className="rc-float" data-testid="float-chip">
      <a href={buyUrl()} target="_blank" rel="noreferrer">
        Buy {BRAND.symbol}
        {TOKEN.isLive ? "" : " · at launch"}
      </a>
      <button
        type="button"
        aria-label="Hide"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            // ignore
          }
        }}
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
