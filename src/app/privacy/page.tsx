import { BRAND } from "@/config/brand";
import { Doc } from "@/components/site/Doc";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/privacy", title: `Privacy policy | ${BRAND.name}`, description: `What ${BRAND.name} keeps (almost nothing), what stays in your browser, and what becomes public on Robinhood Chain.` });

export default function PrivacyPage() {
  return (
    <Doc
      path="/privacy"
      crumb="Privacy policy"
      eyebrow="Privacy"
      title="What we keep: almost nothing."
      sections={[
        { h: "No accounts", p: ["There is no sign-up, no email and no profile. A connected wallet is used in your browser only."] },
        { h: "Addresses you check", p: ["To read history and verification facts, the address goes to our server, which asks the chain and keeps the answer in memory for a few minutes so repeated checks stay fast. It is not tied to you."] },
        { h: "What stays in your browser", list: ["Proof files and calldata you paste.", "Practice registry entries and their signatures.", "Which Explore pages you opened, and whether you closed the buy chip.", "Your wallet choice."] },
        { h: "Rate limits", p: ["To keep the chain reads available for everyone, request counts per network are kept for a few minutes. They hold no address you checked."] },
        { h: "On chain", p: ["Anything you do in the live registry is a public transaction on Robinhood Chain, permanently linked to your wallet address."] },
      ]}
    />
  );
}
