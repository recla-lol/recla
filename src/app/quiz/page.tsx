import { BRAND } from "@/config/brand";
import { Page, PageHead } from "@/components/site/Page";
import { Quiz } from "@/components/quiz/Quiz";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/quiz",
  title: `Safety quiz | ${BRAND.name}`,
  description: "Seven fake-claim patterns — approvals, unlock fees, recovery offers, permits, bait tokens, look-alike addresses — with instant feedback.",
});

export default function QuizPage() {
  return (
    <Page crumb={{ name: "Safety quiz", path: "/quiz" }}>
      <PageHead eyebrow="Safety quiz" title="Seven ways a fake claim gets you." lead="Each one is a pattern that drains real wallets. Pick what you would do; the answer and the reason appear at once. Nothing is stored or sent." />
      <section className="rc-sec pad">
        <div className="rc-wrap max-w-[860px]">
          <Quiz />
        </div>
      </section>
    </Page>
  );
}
