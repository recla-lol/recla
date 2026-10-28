import Link from "next/link";
import { ASSETS } from "@/config/assets";
import { BRAND, CHAIN, TOKEN, buyUrl } from "@/config/brand";
import { JsonLd } from "@/components/JsonLd";
import { ChainPanel } from "@/components/home/ChainPanel";
import { ClaimBand } from "@/components/home/ClaimBand";
import { ExploreProgress } from "@/components/home/ExploreProgress";
import { RegistryFeed } from "@/components/home/RegistryFeed";
import { StatusCard } from "@/components/home/StatusCard";
import { ArrowRight, ArrowUpRight, XLogo } from "@/components/site/Icons";
import { EXPLORE } from "@/components/site/nav";
import { Page } from "@/components/site/Page";
import { appLd } from "@/lib/seo";

export default function Home() {
  return (
    <Page>
      <JsonLd data={appLd} />
      <ClaimBand />

      {/* Hero */}
      <section className="rc-sec rc-glow">
        <div className="rc-wrap grid gap-12 py-20 md:py-24 lg:grid-cols-[minmax(0,1fr)_475px] lg:gap-14">
          <div className="rc-reveal pt-0 lg:pt-[72px]">
            <p className="rc-eyebrow">{CHAIN.name} · source first</p>
            <h1 className="rc-h1 rc-chrome mt-6 max-w-[520px] pb-2">{BRAND.slogan}</h1>
            <p className="rc-lead mt-8 max-w-[557px]">
              {BRAND.name} is a claim checker for {CHAIN.name}. It looks at the contracts that actually pay out — fee escrows, token locks, Merkle distributions, vesting wallets — and tells you what each one says your address can claim.
            </p>
            <p className="rc-lead mt-5 max-w-[557px]">No list of rumoured drops, no screenshots of balances. A claim shows up here only when a contract you can open on the explorer says so, and you claim it yourself.</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/check" className="rc-btn lime lg">
                Check a wallet <ArrowRight size={14} className="arrow" />
              </Link>
              <Link href="/limits" className="rc-btn line lg">
                What {BRAND.name} is not
              </Link>
            </div>
            <a href={BRAND.x} target="_blank" rel="noreferrer" className="rc-arrowlink rc-mono mt-9" style={{ fontSize: 11 }}>
              Follow {BRAND.xHandle} <ArrowUpRight size={13} />
            </a>
          </div>
          <div className="rc-reveal flex flex-col gap-5">
            <div className="rc-card flex items-center p-10">
              <img src={ASSETS.emblem} alt={`${BRAND.name} emblem`} width={240} height={240} className="h-[240px] w-[240px]" />
            </div>
            <StatusCard />
          </div>
        </div>
      </section>

      {/* The limits */}
      <section className="rc-sec tint">
        <div className="rc-wrap grid gap-12 py-20 lg:grid-cols-[minmax(0,1fr)_516px] lg:gap-[72px]">
          <div className="rc-reveal">
            <p className="rc-eyebrow">The limits</p>
            <h2 className="rc-h2 rc-chrome mt-6 pb-1">Not a recovery tool.</h2>
            <p className="rc-lead mt-6">
              {BRAND.name} cannot pull funds back from a drained wallet, undo a transaction or find money that a contract never promised you. It reads what claim contracts already state and shows you the exact call before you make it.
            </p>
            <div className="mt-10">
              <Link href="/limits" className="rc-btn lime">
                Read the full list of limits <ArrowRight size={14} className="arrow" />
              </Link>
            </div>
          </div>
          <dl className="rc-cells rc-reveal m-0">
            <div>
              <dt className="rc-label">What it does</dt>
              <dd className="rc-small m-0 mt-3 text-[15px] leading-[24px]">Reads supported claim contracts for an address, checks proofs you paste against the root the contract stores, and dry-runs the claim from your address.</dd>
            </div>
            <div>
              <dt className="rc-label">What it is not</dt>
              <dd className="rc-small m-0 mt-3 text-[15px] leading-[24px]">Not a way to get hacked funds back, not a reversal service, not a source of free tokens. If someone offers you that in {BRAND.name}&apos;s name, it is not us.</dd>
            </div>
            <div>
              <dt className="rc-label">How you check it</dt>
              <dd className="rc-small m-0 mt-3 text-[15px] leading-[24px]">Every row links to the contract on the explorer and names the view it read. Open it, call the same view yourself, compare the numbers.</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Live chain */}
      <section className="rc-sec">
        <div className="rc-wrap py-20">
          <div className="rc-card rc-glow rc-reveal p-6 md:p-14">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="rc-eyebrow">
                {BRAND.name} · {CHAIN.name}
              </p>
              <span className="rc-pill hatch">
                <span className="sq" /> {TOKEN.isLive ? "Token live" : "Launch not announced"}
              </span>
            </div>
            <h2 className="rc-h2 rc-chrome mt-8 max-w-[760px] pb-1 md:!text-[56px]">THE CHAIN, READ LIVE.</h2>
            <p className="rc-lead mt-8 text-ink">Every number on this site comes from {CHAIN.name} at the moment you look. Here is the chain right now.</p>
            <div className="mt-8">
              <ChainPanel />
            </div>
            <p className="rc-label mt-8" style={{ letterSpacing: "0.18em" }}>
              {TOKEN.isLive ? `${BRAND.symbol} trades on Pons.` : `${BRAND.symbol} launch date: not set. There is no timer until a date is posted on ${BRAND.xHandle}.`}
            </p>
            <div className="mt-10 border-t border-line pt-10">
              <p className="m-0 font-display text-[18px] leading-7 text-ink">Read the contract. Simulate the call. Sign it yourself.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={buyUrl()} target="_blank" rel="noreferrer" className="rc-btn lime lg">
                  {TOKEN.isLive ? `Buy ${BRAND.symbol} on Pons` : `Pons launchpad · ${BRAND.symbol} at launch`} <ArrowUpRight size={14} />
                </a>
                <Link href="/token" className="rc-btn line lg">
                  Token information
                </Link>
              </div>
              <p className="rc-small mt-8 max-w-[640px] text-muted">
                The token is not needed for anything on this site. Launch details are posted here and on {BRAND.xHandle} only; if a date moves, the change is written on the update history page with the reason.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Live sources */}
      <section className="rc-sec pad border-t border-line">
        <div className="rc-wrap">
          <p className="rc-eyebrow">Live from the chain</p>
          <h2 className="rc-h3 mt-4">Sources {BRAND.name} reads</h2>
          <p className="rc-body mt-4 max-w-[768px]">Two contracts are read for every wallet today. Community sources join through the registry, where other wallets can attest the rules or flag them.</p>
          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,597px)_minmax(0,1fr)]">
            <RegistryFeed />
            <div>
              <span className="rc-label">Official account</span>
              <a href={BRAND.x} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-between border border-line px-4 py-3 no-underline">
                <span className="flex items-center gap-3 font-mono text-[14px] text-ink">
                  <XLogo size={18} /> {BRAND.xHandle}
                </span>
                <ArrowUpRight size={13} />
              </a>
              <p className="mt-6 text-[16px] leading-[26px] text-soft">
                New sources, corrections and the token address are announced on {BRAND.xHandle} and on this site. Only this site and that account speak for {BRAND.name}.
              </p>
              <p className="rc-small mt-5 text-muted">
                A claim link that arrives in your messages is the most common way wallets get drained. {BRAND.name} never sends one first. Type the address of this site yourself, and never sign an approval to &quot;claim&quot;.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Explore */}
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <p className="rc-eyebrow">Explore</p>
          <h2 className="rc-h3 mt-4">Check the source, not the story</h2>
          <p className="rc-body mt-4 max-w-[768px]">Six places, each quick to use. Reading needs no account and no signature; only a claim you choose to make asks your wallet for one.</p>
          <div className="rc-tilegrid mt-10">
            {EXPLORE.map((e, i) => (
              <Link key={e.href} href={e.href} className="rc-tile">
                <span className="rc-mono text-lime" style={{ fontSize: 11 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <ArrowRight size={14} className="arrow" />
                <h3 className="rc-h4 mt-6 text-ink transition-colors">{e.title}</h3>
                <p className="rc-small mt-3 text-[15px] leading-[24px]">{e.text}</p>
              </Link>
            ))}
          </div>
          <ExploreProgress />
        </div>
      </section>

      {/* Position */}
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <p className="rc-eyebrow">Position</p>
          <h2 className="rc-h3 mt-4">What {BRAND.name} stands for</h2>
          <div className="mt-8 max-w-[768px] space-y-6">
            <p className="rc-body">Claims attract two kinds of noise: rumours that a wallet is owed something, and pages that ask for a signature to collect it. Both skip the one question that matters — which contract pays, and what does it say about you?</p>
            <p className="rc-body">{BRAND.name} answers only that question. A supported source is a contract with a read path we confirmed against its verified code. Anything else is shown as unknown, not as a maybe.</p>
            <p className="rc-body">In practice: every amount names the view it came from, every claim names the function it calls, and every source links to its code on the explorer. Where we cannot read something, the field stays empty and says why.</p>
          </div>
          <Link href="/sources" className="rc-btn line mt-10">
            See every supported source <ArrowRight size={14} className="arrow" />
          </Link>
        </div>
      </section>

      {/* Safety */}
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <p className="rc-eyebrow">Safety</p>
          <h2 className="rc-h3 mt-4">Verify before you claim</h2>
          <div className="mt-6 max-w-[768px] space-y-6">
            <p className="rc-body">A real claim never needs you to approve a token or send a fee first. The contract pays you; you only pay network gas.</p>
            <p className="rc-body">Before you sign, compare every character of the contract address in your wallet with the one {BRAND.name} shows, then look it up on the {CHAIN.name} explorer yourself instead of a link someone sent.</p>
            <p className="rc-body">Run the simulator first. If the dry run reverts, the real transaction would revert too, and you keep your gas.</p>
          </div>
          <Link href="/verify" className="rc-btn lime lg mt-10">
            Read the verification guide <ArrowRight size={14} className="arrow" />
          </Link>
        </div>
      </section>

      {/* Risk band */}
      <section className="rc-sec" style={{ background: "var(--panel-2)", borderTop: "1px solid rgba(183,255,53,.25)", borderBottom: "1px solid rgba(183,255,53,.25)" }}>
        <div className="rc-wrap grid items-center gap-10 py-16 md:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <p className="rc-eyebrow">Risk</p>
            <p className="mt-5 font-display text-[20px] leading-[30px] font-semibold text-ink md:text-[24px] md:leading-[32px]">
              {BRAND.symbol} is a community token with no promised value; it can fall to zero. A claim that {BRAND.name} reads can still fail, be smaller than expected, or come from a contract with its own risks.
            </p>
            <Link href="/risks" className="rc-btn line mt-8">
              Read the risk disclosure <ArrowRight size={14} className="arrow" />
            </Link>
          </div>
          <div className="rc-card flex justify-center p-5">
            <img src={ASSETS.emblem} alt="" width={160} height={160} className="h-[160px] w-[160px]" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="rc-sec">
        <div className="rc-wrap py-24 text-center">
          <h2 className="rc-h2">Check first. Claim yourself.</h2>
          <p className="rc-body mx-auto mt-6 max-w-[600px] text-[16px] leading-[26px]">New sources and corrections are posted on one account. Nothing else speaks for {BRAND.name}.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a href={BRAND.x} target="_blank" rel="noreferrer" className="rc-btn lime lg">
              Follow {BRAND.xHandle} on X <ArrowUpRight size={14} />
            </a>
            <Link href="/token" className="rc-btn line lg">
              Token facts <ArrowRight size={14} className="arrow" />
            </Link>
          </div>
          <p className="rc-label mt-9" style={{ fontSize: 12 }}>
            {BRAND.symbol} contract: {TOKEN.isLive ? BRAND.ca : "not out yet"}
          </p>
        </div>
      </section>
    </Page>
  );
}
