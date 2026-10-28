"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { storageKey } from "@/config/storage";
import { EXPLORE } from "@/components/site/nav";

export const VISITED_KEY = storageKey("explored");

export function readVisited(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(VISITED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Records which of the Explore places this browser has opened (local only), and draws the scroll rail. */
export function Track() {
  const path = usePathname() ?? "/";
  const [top, setTop] = useState(0);
  useEffect(() => {
    if (!EXPLORE.some((e) => e.href === path)) return;
    const v = readVisited();
    if (!v.includes(path)) {
      try {
        localStorage.setItem(VISITED_KEY, JSON.stringify([...v, path]));
      } catch {
        // storage blocked
      }
    }
  }, [path]);
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setTop(max > 0 ? (window.scrollY / max) * (window.innerHeight - 64) : 0);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  return <span className="rc-rail" style={{ top }} aria-hidden="true" />;
}
