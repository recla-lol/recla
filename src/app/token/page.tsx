import { BRAND, CHAIN } from "@/config/brand";
import { Page, PageHead } from "@/components/site/Page";
import { TokenFacts } from "@/components/token/TokenFacts";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/token", title: `${BRAND.symbol} token | ${BRAND.name}`, description: `${BRAND.symbol}, the community token of ${BRAND.name} on ${CHAIN.name}: official address, on-chain facts, what is live and what is planned.` });

export default function TokenPage() {
  return (
    <Page crumb={{ name: "Token", path: "/token" }}>
      <PageHead
        eyebrow={`${BRAND.symbol} · token information`}
        title={`${BRAND.symbol}, stated plainly.`}
        lead={`${BRAND.symbol} is the community token of ${BRAND.name}, launching on Pons on ${CHAIN.name}. It has no promised value. Nothing on this site needs it: every check, the simulator and the registry work without it.`}
      />
      <section className="rc-sec pad">
        <div className="rc-wrap grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
          <TokenFacts />
          <div className="rc-doc">
            <h2 style={{ marginTop: 0 }}>Planned utility</h2>
            <ul>
              <li>Analytics credits for deeper claim reports.</li>
              <li>Premium monitoring: alerts when a supported source owes your wallet something new.</li>
              <li>Developer API access.</li>
            </ul>
            <p>All three are planned, not built. They will be announced when they work.</p>
            <h2>One address</h2>
            <p>The only contract address is the one on this page and on {BRAND.xHandle}. Fake tokens with the same name appear on every launch; check the whole address.</p>
          </div>
        </div>
      </section>
    </Page>
  );
}
