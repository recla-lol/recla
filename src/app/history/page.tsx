import { Suspense } from "react";
import { BRAND, CHAIN } from "@/config/brand";
import { HistoryView } from "@/components/history/HistoryView";
import { Page, PageHead } from "@/components/site/Page";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/history",
  title: `Claim history | ${BRAND.name}`,
  description: `Claims, credits, locks and withdrawals of a wallet in the supported sources, read from ${CHAIN.name} events with explorer links.`,
});

export default function HistoryPage() {
  return (
    <Page crumb={{ name: "Claim history", path: "/history" }}>
      <PageHead
        eyebrow="Claim history"
        title="Every claim, back to the block."
        lead={`${BRAND.name} reads the events each supported contract emits for your address — claims and token credits in the Pons fee escrow, locks and withdrawals on HoodLock, your registry entries — and links every one to its transaction.`}
      />
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <Suspense fallback={<p className="rc-small">Loading…</p>}>
            <HistoryView />
          </Suspense>
        </div>
      </section>
    </Page>
  );
}
