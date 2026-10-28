import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="rc-main">
        <section className="rc-sec pad">
          <div className="rc-wrap">
            <p className="rc-eyebrow">404 · no source</p>
            <h1 className="rc-h1 rc-chrome mt-6">Nothing at this path.</h1>
            <p className="rc-lead mt-6 max-w-[560px]">This page has no source, the same way a claim without a contract has none. The claim check is one click away.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/check" className="rc-btn lime lg">
                Check a wallet
              </Link>
              <Link href="/" className="rc-btn line lg">
                Home
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
