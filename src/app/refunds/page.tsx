import { BRAND } from "@/config/brand";
import { Page, PageHead } from "@/components/site/Page";
import { RefundExplorer } from "@/components/refunds/RefundExplorer";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/refunds",
  title: `Refund explorer | ${BRAND.name}`,
  description: `Refunds that a contract states itself, read for your address. ${BRAND.name} never estimates a refund and says so when no supported source offers one.`,
});

export default function RefundsPage() {
  return (
    <Page crumb={{ name: "Refund explorer", path: "/refunds" }}>
      <PageHead
        eyebrow="Refund explorer"
        title="Refunds a contract states, nothing else."
        lead="Some protocols build a refund into their contract — a cancelled sale, an overpaid deposit. If the contract exposes the amount, it shows here. If it does not, there is nothing to read, and we will not guess."
      />
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <RefundExplorer />
        </div>
      </section>
    </Page>
  );
}
