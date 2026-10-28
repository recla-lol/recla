import { BRAND } from "@/config/brand";
import { Doc } from "@/components/site/Doc";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/contact", title: `Contact | ${BRAND.name}`, description: `How to reach ${BRAND.name} on X, how to report a wrong number or a bad source, and how to spot someone pretending to be us.` });

export default function ContactPage() {
  return (
    <Doc
      path="/contact"
      crumb="Contact"
      eyebrow="Contact"
      title="One account, one site."
      lead={`Reach ${BRAND.name} through ${BRAND.xHandle} on X. Corrections, new sources and the token address are posted there and on ${BRAND.domain}.`}
      sections={[
        { h: "Report a wrong number", p: ["If a claim row disagrees with what the contract returns on the explorer, post the address of the source and the view you called, mentioning the account. Corrections go on the update history page."] },
        { h: "Report a bad source", p: ["Once the registry is deployed, flag the entry on chain with a reason; the count is public. Until then, tell us on X."] },
        { h: "Impersonation", p: ["We never DM first, never ask for a seed phrase, approval or fee, and never send claim links. Anything that does is not us."] },
      ]}
    >
      <p>
        <a href={BRAND.x} target="_blank" rel="noreferrer">
          {BRAND.x}
        </a>
      </p>
    </Doc>
  );
}
