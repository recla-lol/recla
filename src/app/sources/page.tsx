import Link from "next/link";
import { BRAND, CHAIN, explorerAddress } from "@/config/brand";
import { HOODLOCK, KINDS, PONS_ESCROW } from "@/config/sources";
import { ArrowRight, ArrowUpRight } from "@/components/site/Icons";
import { Page, PageHead } from "@/components/site/Page";
import { SourceFacts } from "@/components/sources/SourceFacts";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/sources",
  title: `Supported claim sources | ${BRAND.name}`,
  description: `Every claim source ${BRAND.name} reads on ${CHAIN.name}: contract, creation block, rules link, the views read, the claim call, the events, and live verification facts.`,
});

const BUILT_IN = [PONS_ESCROW, HOODLOCK];

export default function SourcesPage() {
  return (
    <Page crumb={{ name: "Sources", path: "/sources" }}>
      <PageHead
        eyebrow="Claim verification"
        title="Every source, labelled read, stated or unknown."
        lead={`A source is supported when ${BRAND.name} confirmed its read path against the contract's verified code. Each card shows what is read, which call claims, and live facts you can compare with the explorer yourself.`}
      />
      <section className="rc-sec pad">
        <div className="rc-wrap grid gap-6">
          {BUILT_IN.map((s) => (
            <article key={s.key} className="rc-card grid gap-8 p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_360px]" data-testid="source-card">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rc-pill lime">
                    <span className="sq" /> Read path confirmed
                  </span>
                  <span className="rc-label">Built in</span>
                </div>
                <h2 className="rc-h3 mt-4">{s.name}</h2>
                <p className="rc-body mt-3">{s.summary}</p>
                <dl className="mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <dt className="rc-label">Contract</dt>
                    <dd className="m-0 mt-1 font-mono text-[13px] break-all">
                      <a className="rc-link" href={explorerAddress(s.address)} target="_blank" rel="noreferrer">
                        {s.address}
                      </a>
                      <span className="block text-muted">{s.contractName} · created at block {s.deployBlock.toLocaleString("en-US")}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="rc-label">Rules (stated by the operator)</dt>
                    <dd className="m-0 mt-1 font-mono text-[13px]">
                      <a className="rc-link" href={s.rulesUrl} target="_blank" rel="noreferrer">
                        {s.rulesUrl.replace("https://", "")} <ArrowUpRight size={11} />
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="rc-label">Views {BRAND.name} reads</dt>
                    <dd className="m-0 mt-1 font-mono text-[12px] text-soft">{s.views.join(" · ")}</dd>
                  </div>
                  <div>
                    <dt className="rc-label">Claim call</dt>
                    <dd className="m-0 mt-1 font-mono text-[12px] text-soft">{s.claims.join(" · ")}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="rc-label">Events read for history</dt>
                    <dd className="m-0 mt-1 font-mono text-[12px] text-soft">{s.events.join(" · ")}</dd>
                  </div>
                </dl>
              </div>
              <div className="rc-card soft h-fit p-5">
                <span className="rc-label">Live verification</span>
                <div className="mt-3">
                  <SourceFacts address={s.address} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <p className="rc-eyebrow">Kinds</p>
          <h2 className="rc-h3 mt-4">How each kind of source is read</h2>
          <div className="rc-scroll mt-8">
            <table className="rc-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Kind</th>
                  <th>Read path</th>
                </tr>
              </thead>
              <tbody>
                {KINDS.map((k) => (
                  <tr key={k.code}>
                    <td className="font-mono">{k.code}</td>
                    <td className="text-ink">{k.label}</td>
                    <td>{k.read}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rc-small mt-6 max-w-[760px]">
            Labels used across the site: <span className="text-lime">read</span> = an on-chain view answered just now; <span className="text-ink">stated</span> = written by the source&apos;s operator (rules pages), not checked by code; <span className="text-muted">unknown</span> = nothing to read, shown as &quot;—&quot;.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/registry" className="rc-btn lime">
              Community sources in the registry <ArrowRight size={14} className="arrow" />
            </Link>
            <a href="/contracts.json" className="rc-btn line">
              contracts.json
            </a>
          </div>
        </div>
      </section>
    </Page>
  );
}
