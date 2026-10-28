import { BRAND, CHAIN } from "@/config/brand";
import { Page, PageHead } from "@/components/site/Page";
import { RegistryWorkspace } from "@/components/registry/RegistryWorkspace";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/registry",
  title: `Source registry | ${BRAND.name}`,
  description: `Register a claim source on ${CHAIN.name} with its rules link and hash; other wallets attest that the rules match the contract or flag it. No admin, nothing hidden.`,
});

export default function RegistryPage() {
  return (
    <Page crumb={{ name: "Source registry", path: "/registry" }}>
      <PageHead
        eyebrow="Source registry · on chain"
        title="Who says this contract pays?"
        lead={`Anyone can register a claim source: the contract, its kind, a link to its rules and a hash of those rules. Other wallets then attest that the rules match the contract, or flag it with a reason. One response per wallet, counts in the open, no admin — ${BRAND.name} included.`}
      />
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <RegistryWorkspace />
        </div>
      </section>
    </Page>
  );
}
