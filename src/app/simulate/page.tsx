import { Suspense } from "react";
import { BRAND, CHAIN } from "@/config/brand";
import { Page, PageHead } from "@/components/site/Page";
import { Simulator } from "@/components/simulate/Simulator";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/simulate",
  title: `Claim simulator | ${BRAND.name}`,
  description: `Dry-run a claim on ${CHAIN.name} from your own address before signing: would it succeed or revert, why, and what should arrive. Nothing is sent.`,
});

export default function SimulatePage() {
  return (
    <Page crumb={{ name: "Claim simulator", path: "/simulate" }}>
      <PageHead
        eyebrow="Claim simulator"
        title="Run the claim before you sign it."
        lead={`The simulator executes the exact claim call on ${CHAIN.name} from the claimer's address, against the latest block, without sending anything. You see whether it would succeed, the revert reason if not, and the balance change the source states. Signing stays in your wallet.`}
      />
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <Suspense fallback={<p className="rc-small">Loading…</p>}>
            <Simulator />
          </Suspense>
          <p className="rc-note mt-8 max-w-[760px]">A simulation shows how the contract behaves on the current state. State can change between the dry run and your transaction (someone claims first, a lock owner changes), so the wallet&apos;s own preview is the final word.</p>
        </div>
      </section>
    </Page>
  );
}
