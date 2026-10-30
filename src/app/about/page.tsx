import { BRAND, CHAIN } from "@/config/brand";
import { Doc } from "@/components/site/Doc";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/about", title: `About ${BRAND.name} | ${BRAND.name}`, description: `${BRAND.name}: claim discovery and eligibility on ${CHAIN.name}. Why it exists, what it reads, what is planned.` });

export default function AboutPage() {
  return (
    <Doc
      path="/about"
      crumb="About"
      eyebrow="About"
      title={BRAND.tagline}
      lead={`${BRAND.name} helps people on ${CHAIN.name} see the claims their address really has — token distributions, lock and vesting releases, creator fees, refunds a protocol built in — together with the contract, the rules and the transaction needed, before they decide to claim themselves.`}
      sections={[
        { h: "Why it exists", p: ["Claims are where wallets get hurt. Real ones are scattered across contracts with different read paths; fake ones arrive as links and ask for signatures. The useful question is narrow: which contract pays, and what does it state for this address? Recla is built around that question and nothing else."] },
        {
          h: "Principles",
          list: [
            "Every claim has a source: an amount without a contract behind it is not shown.",
            "Read, stated or unknown: each fact says where it came from; unknown stays '—'.",
            "Simulate before signing: the dry run is one click away from every claim.",
            "You sign, always: Recla never sends a transaction and never holds funds.",
            "No admin over the registry: entries and flags are public and permanent.",
          ],
        },
        {
          h: "What runs today",
          list: [
            "Claim check for the Pons creator fee escrow (ETH and pair tokens) and HoodLock token locks.",
            "Merkle eligibility checker for any distributor, with your proof file.",
            "Vesting tracker for vesting wallets that expose owner() and releasable().",
            "Refund explorer for contracts that state a refund through a view.",
            "Claim simulator, claim history, source verification facts.",
            "The source registry contract, deployed and verified on Robinhood Chain.",
          ],
        },
        { h: "Planned, not built", list: ["Monitoring and alerts when a new claim appears for a wallet.", "Premium analytics.", "A developer API.", `${BRAND.symbol} utility: analytics credits and access to the above.`], p: ["Planned means planned. These will be announced when they work, not before."] },
      ]}
    />
  );
}
