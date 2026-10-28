import Link from "next/link";
import { BRAND, CHAIN, TOKEN, buyUrl } from "@/config/brand";
import { ASSETS } from "@/config/assets";
import { CaButton } from "@/components/site/CaCopy";
import { ArrowUpRight, XLogo } from "@/components/site/Icons";
import { FOOTER_COLS, LEGAL } from "@/components/site/nav";

export const LAST_UPDATE = "30 October 2026";

export function SiteFooter() {
  return (
    <footer className="rc-foot">
      <div className="rc-wrap flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="rc-eyebrow">Official channel</p>
          <p className="rc-small mt-2">Announcements, corrections and the contract address are posted here and on X only.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a className="rc-btn lime mono" href={buyUrl()} target="_blank" rel="noreferrer">
            Buy {BRAND.symbol} on Pons{TOKEN.isLive ? "" : " · at launch"}
          </a>
          <a className="rc-btn ghost mono" href={BRAND.x} target="_blank" rel="noreferrer">
            Follow {BRAND.xHandle} <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
      <div className="rc-wrap">
        <div className="border-t border-line" />
      </div>
      <div className="rc-wrap py-14">
        <div className="cols">
          <div>
            <Link href="/" className="rc-brand" aria-label={`${BRAND.name} home`}>
              <img src={ASSETS.mark} alt="" width={56} height={56} style={{ width: 56, height: 56 }} />
              <span>{BRAND.name}</span>
            </Link>
            <p className="rc-small mt-8 max-w-[220px]">{BRAND.slogan} Read from the contract, signed by you.</p>
            <a className="rc-btn ghost mono mt-6" style={{ color: "var(--lime)", borderColor: "rgba(183,255,53,.45)" }} href={BRAND.x} target="_blank" rel="noreferrer">
              <XLogo size={13} /> {BRAND.xHandle}
            </a>
            <h4 className="mt-8">The fine print</h4>
            <ul>
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          {FOOTER_COLS.map((c) => (
            <div key={c.title}>
              <h4>{c.title}</h4>
              <ul>
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="rc-wrap py-8">
          <div className="flex flex-col gap-3 md:flex-row md:justify-between">
            <p className="rc-label m-0">© {BRAND.name} · every claim has a source.</p>
            <div className="flex flex-wrap items-center gap-4">
              <p className="rc-label m-0">Last published update: {LAST_UPDATE}</p>
              <CaButton className="rc-btn ghost mono" />
            </div>
          </div>
          <p className="rc-note mt-5 max-w-[880px] leading-[1.8]">
            {BRAND.name} reads public contracts on {CHAIN.name} (chain id {CHAIN.id}) and never sends a transaction for you. It is not a tool to recover funds from a hacked wallet, it cannot reverse a transaction and it does not promise free assets. {BRAND.symbol} is a community token with no promised value. Nothing here is financial, legal or tax advice. Only two channels speak for {BRAND.name}: this website and{" "}
            <a className="underline" href={BRAND.x} target="_blank" rel="noreferrer">
              {BRAND.x}
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
