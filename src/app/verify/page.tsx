import { BRAND, CHAIN, TOKEN } from "@/config/brand";
import { Doc } from "@/components/site/Doc";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/verify", title: `How to verify a claim | ${BRAND.name}`, description: `Check a claim source and the ${BRAND.symbol} address yourself on ${CHAIN.name}: code, verified source, the view, the call, the simulation.` });

export default function VerifyPage() {
  return (
    <Doc
      path="/verify"
      crumb="How to verify"
      eyebrow="Verification guide"
      title="Check it yourself in five steps."
      lead={`Nothing ${BRAND.name} shows needs to be taken on trust. Here is how to repeat each check with public tools.`}
      sections={[
        { h: "1. Find the contract, not the page", p: ["Every claim row names the contract it came from. Open that address on the Robinhood Chain explorer by typing the explorer address yourself, not by following a link someone sent."] },
        { h: "2. Confirm there is code and it is verified", p: ["A claim source must be a contract. On the explorer, check that the address has code and, ideally, a verified source. The Sources page shows both facts live; 'unknown' means we could not find a verified source, not that one does not exist."] },
        { h: "3. Call the same view", p: ["On the explorer's Read Contract tab, call the view Recla names (for example balanceOf on the fee escrow, or getLock on the locker) with your address. The number must match."] },
        { h: "4. Simulate the claim", p: ["Run the claim through the simulator from your own address. If it reverts, read the reason and stop. A real claim never needs an approval, a permit or a payment to anyone but the network."] },
        { h: "5. Read what your wallet shows", p: ["Your wallet shows the contract and the function before you sign. Compare every character of the address with the one on the claim row."] },
        { h: `The ${BRAND.symbol} address`, p: [TOKEN.isLive ? `The only ${BRAND.symbol} contract is ${BRAND.ca}. It is published here and on ${BRAND.xHandle}.` : `${BRAND.symbol} has not launched. There is no official address yet; assume any address shown to you elsewhere is fake until it appears here and on ${BRAND.xHandle}.`] },
      ]}
    />
  );
}
