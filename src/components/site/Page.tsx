import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { breadcrumbLd } from "@/lib/seo";

/** Header, main and footer around a page, with its breadcrumb. */
export function Page({ children, crumb }: { children: React.ReactNode; crumb?: { name: string; path: string } }) {
  return (
    <>
      <SiteHeader />
      {crumb ? <JsonLd data={breadcrumbLd([crumb])} /> : null}
      <main id="main" className="rc-main">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

/** The opening block of an inner page: eyebrow, chrome title, lead. */
export function PageHead({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="rc-sec rc-glow">
      <div className="rc-wrap pt-20 pb-14 md:pt-24">
        <p className="rc-eyebrow">{eyebrow}</p>
        <h1 className="rc-h2 rc-chrome mt-6 max-w-[820px] pb-1 md:!text-[56px]">{title}</h1>
        {lead ? <div className="rc-lead mt-6 max-w-[720px]">{lead}</div> : null}
        {children}
      </div>
    </section>
  );
}
