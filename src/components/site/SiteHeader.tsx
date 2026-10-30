"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BRAND, buyUrl, hasGithub, TOKEN } from "@/config/brand";
import { Brand } from "@/components/site/Brand";
import { CaButton } from "@/components/site/CaCopy";
import { CloseIcon, GitHubLogo, MenuIcon, XLogo } from "@/components/site/Icons";
import { TOP_NAV } from "@/components/site/nav";
import { NavWallet } from "@/components/wallet/WalletButton";

export function BuyButton({ className = "rc-btn lime" }: { className?: string }) {
  return (
    <a className={className} href={buyUrl()} target="_blank" rel="noreferrer" data-testid="buy-btn" title={TOKEN.isLive ? `Buy ${BRAND.symbol} on Pons` : `${BRAND.symbol} launches on Pons; this opens the launchpad home`}>
      Buy {BRAND.symbol}
      {TOKEN.isLive ? null : <small className="soon">at launch</small>}
    </a>
  );
}

export function SiteHeader() {
  const path = usePathname() ?? "/";
  // The drawer remembers the path it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  return (
    <>
      <a href="#main" className="rc-skip">
        Skip to content
      </a>
      <header className="rc-nav">
        <div className="row">
          <Brand />
          <nav className="rc-navlinks" aria-label="Main">
            {TOP_NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="rc-navcta">
            <NavWallet className="rc-btn lime mono" label="Connect" />
            <Link href="/quiz" className="quiz hide-sm">
              Safety quiz
            </Link>
            <a className="rc-btn ghost mono hide-xs" href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X`}>
              <XLogo size={14} /> <span className="hide-sm">{BRAND.xHandle}</span>
            </a>
            {hasGithub ? (
              <a className="rc-btn ghost mono hide-xs" href={BRAND.github} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} source code on GitHub`} title="Source code on GitHub">
                <GitHubLogo size={15} />
              </a>
            ) : null}
            <button type="button" className="rc-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpenOn(open ? null : path)} data-testid="burger">
              {open ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>
        </div>
      </header>
      {open ? (
        <div className="rc-sheet" data-testid="menu-sheet">
          {TOP_NAV.map((n) => (
            <Link key={n.href} href={n.href} className="item">
              {n.label}
            </Link>
          ))}
          <Link href="/quiz" className="item">
            Safety quiz
          </Link>
          <a href={BRAND.x} target="_blank" rel="noreferrer" className="item">
            X {BRAND.xHandle}
          </a>
          {hasGithub ? (
            <a href={BRAND.github} target="_blank" rel="noreferrer" className="item">
              Source on GitHub
            </a>
          ) : null}
          <div className="ctas">
            <BuyButton />
            <CaButton className="rc-btn ghost" />
          </div>
        </div>
      ) : null}
    </>
  );
}
