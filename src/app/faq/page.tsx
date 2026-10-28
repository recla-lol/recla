import { BRAND } from "@/config/brand";
import { JsonLd } from "@/components/JsonLd";
import { Page, PageHead } from "@/components/site/Page";
import { FAQ } from "@/content/faq";
import { faqLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/faq", title: `FAQ | ${BRAND.name}`, description: `Questions about ${BRAND.name}: what it reads, what it cannot do, the simulator, the registry and ${BRAND.symbol}.` });

export default function FaqPage() {
  return (
    <Page crumb={{ name: "FAQ", path: "/faq" }}>
      <JsonLd data={faqLd(FAQ)} />
      <PageHead eyebrow="FAQ" title="Questions, answered plainly." />
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <div className="rc-cells max-w-[860px]">
            {FAQ.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] text-ink">
                  {f.q}
                  <span className="rc-mono text-lime transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="rc-small mt-4 text-[15px] leading-[25px]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}
