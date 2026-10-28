import { BRAND, CHAIN } from "@/config/brand";
import { Doc } from "@/components/site/Doc";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/risks", title: `Risk disclosure | ${BRAND.name}`, description: `Risks of claiming on ${CHAIN.name} and of holding ${BRAND.symbol}, stated plainly.` });

export default function RisksPage() {
  return (
    <Doc
      path="/risks"
      crumb="Risk disclosure"
      eyebrow="Risk disclosure"
      title="What can go wrong."
      sections={[
        { h: `${BRAND.symbol}`, p: [`${BRAND.symbol} is a community token with no promised value, no yield and no claim on anything. Its price can fall to zero. Buy only what you can afford to lose, and do your own research.`] },
        { h: "Claim sources", p: ["A source Recla reads is a third-party contract. It can contain bugs, its operator may hold powers over it, and its rules can change. A readable balance is not a promise that the claim will succeed or that the token claimed is worth anything."] },
        { h: "Simulation", p: ["A dry run reflects the chain at one block. Someone else can change the state before your transaction lands; gas spent on a failed transaction is not returned."] },
        { h: "Registry", p: ["Attestations and flags are opinions of wallets. Anyone can create many wallets. Counts are information, not a verdict."] },
        { h: "Network", p: [`${CHAIN.name} is a young network. Outages, reorganisations and RPC errors can delay or hide data. When a read fails, Recla says so instead of showing a guess.`] },
        { h: "No advice", p: ["Nothing on this site is financial, legal or tax advice."] },
      ]}
    />
  );
}
