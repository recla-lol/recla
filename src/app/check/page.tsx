import { Suspense } from "react";
import { BRAND, CHAIN } from "@/config/brand";
import { ClaimCheck } from "@/components/check/ClaimCheck";
import { MerkleChecker, VestingChecker } from "@/components/check/SourceCheckers";
import { TokenLocks } from "@/components/check/TokenLocks";
import { Page, PageHead } from "@/components/site/Page";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/check",
  title: `Claim check | ${BRAND.name}`,
  description: `See what supported claim contracts on ${CHAIN.name} say a wallet can claim: Pons creator fees, HoodLock locks, Merkle drops, vesting. Read only.`,
});

export default function CheckPage() {
  return (
    <Page crumb={{ name: "Claim check", path: "/check" }}>
      <PageHead
        eyebrow="Claim discovery · eligibility"
        title="What can this wallet claim?"
        lead={`Paste any address on ${CHAIN.name}. ${BRAND.name} asks each supported contract directly and shows its answer, the view it read and the call that would claim it. Reading needs no wallet and no signature.`}
      />
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <Suspense fallback={<p className="rc-small">Loading…</p>}>
            <ClaimCheck />
          </Suspense>
        </div>
      </section>
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <p className="rc-eyebrow">Sources you name</p>
          <h2 className="rc-h3 mt-4">Distributions and vesting outside the built-in list</h2>
          <p className="rc-body mt-4 max-w-[768px]">
            Some claims need something only you have, like the proof file of a distribution. These checks run against the contract you paste; {BRAND.name} reads it with a low gas limit and never
            stores what you paste.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <MerkleChecker />
            <VestingChecker />
          </div>
        </div>
      </section>
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <p className="rc-eyebrow">Locks by token</p>
          <h2 className="rc-h3 mt-4">How much of a token is locked, and until when</h2>
          <p className="rc-body mt-4 max-w-[768px]">
            Start from the token instead of the wallet: every active HoodLock lock of one token, with its owner, amount, share of the total supply and unlock time.
          </p>
          <div className="mt-10">
            <TokenLocks />
          </div>
        </div>
      </section>
    </Page>
  );
}
