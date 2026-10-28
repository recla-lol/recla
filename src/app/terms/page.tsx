import { BRAND } from "@/config/brand";
import { Doc } from "@/components/site/Doc";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/terms", title: `Terms of use | ${BRAND.name}`, description: `Terms for using ${BRAND.name}: read-only tools, your own signatures, no warranties.` });

export default function TermsPage() {
  return (
    <Doc
      path="/terms"
      crumb="Terms of use"
      eyebrow="Terms"
      title="Terms of use."
      lead="Short version: the tools read public data, you decide and sign everything yourself, and nothing here is guaranteed."
      sections={[
        { h: "The service", p: [`${BRAND.name} provides read-only views of public contracts, a simulator and an open registry contract. It never takes custody of assets and never sends transactions on your behalf.`] },
        { h: "Your responsibility", p: ["You are responsible for every transaction you sign, for checking addresses, and for following the laws that apply to you."] },
        { h: "No warranty", p: ["The site and its data are provided as they are. Reads can be late, incomplete or wrong when the chain or a provider fails. Do not rely on them as your only check."] },
        { h: "Third parties", p: ["Claim sources, launchpads, explorers and wallets are run by others. Their terms apply to them."] },
        { h: "Changes", p: ["When these terms change, the date and the change are written on the update history page."] },
      ]}
    />
  );
}
