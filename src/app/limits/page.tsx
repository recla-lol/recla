import { BRAND, CHAIN } from "@/config/brand";
import { Doc } from "@/components/site/Doc";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/limits", title: `What ${BRAND.name} is not | ${BRAND.name}`, description: `${BRAND.name} reads claim contracts. It is not a recovery service, cannot reverse transactions and does not promise free assets. The full list of limits.` });

export default function LimitsPage() {
  return (
    <Doc
      path="/limits"
      crumb="Limits"
      eyebrow="The limits"
      title="What Recla is not, in plain words."
      lead={`${BRAND.name} reads what claim contracts on ${CHAIN.name} already say. Everything below is outside that, and we would rather tell you now than after you trusted us.`}
      sections={[
        { h: "Not a recovery tool", p: ["If funds left your wallet through a signature you gave or a key someone stole, they are gone from your control. No website, contract or support agent can pull them back. Recla cannot either, and it never asks for your seed phrase or a 'recovery fee'."] },
        { h: "Not a reversal service", p: [`A confirmed transaction on ${CHAIN.name} is final. Recla has no power over the chain, over other contracts, or over the explorers.`] },
        { h: "Not a source of free assets", p: ["A claim appears only when a contract states it. Most addresses have nothing waiting in most sources, and Recla says so instead of inventing a balance. There is no airdrop, no reward and no giveaway from Recla."] },
        { h: "Not a judge of safety", p: ["A source being readable, registered or attested does not make it safe. Contracts have bugs; operators change their minds; rules pages can be edited. Recla shows facts with their origin so you can decide."] },
        { h: "Not a custodian", p: ["Recla never holds funds and never sends transactions for you. The registry contract has no payable function, no owner and no admin. Every claim is a transaction your own wallet shows and you sign."] },
        {
          h: "What it does, exactly",
          list: [
            "Reads supported claim contracts for any address, with the view it called.",
            "Checks a Merkle proof you paste against the root the contract stores, in your browser.",
            "Dry-runs the claim from your address and explains a revert.",
            "Lists claim-related events of your address from chain, with links.",
            "Keeps an open, on-chain registry of sources that wallets can attest or flag.",
          ],
        },
        { h: "If someone claims to be Recla", p: [`Recla never DMs first, never asks you to approve a token, never asks for a fee to unlock a claim. The only channels are ${BRAND.domain} and ${BRAND.xHandle} on X.`] },
      ]}
    />
  );
}
