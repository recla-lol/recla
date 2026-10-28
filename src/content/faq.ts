import { BRAND, CHAIN } from "@/config/brand";

/** Questions and answers (FAQ page + structured data). */
export const FAQ = [
  { q: `What does ${BRAND.name} do?`, a: `It asks claim contracts on ${CHAIN.name} what they owe an address — the Pons creator fee escrow, HoodLock token locks, Merkle distributors you name with your proof file, vesting wallets and refund contracts — and shows each answer with the contract it came from. It can also dry-run the claim from your address before you sign it in your own wallet.` },
  { q: `Can ${BRAND.name} get back funds from a hacked wallet?`, a: "No. Nobody can reverse a confirmed transaction or pull funds back from the address that took them. Anyone who offers that, in our name or not, is running a scam." },
  { q: "Does it promise free tokens?", a: `No. ${BRAND.name} only reports what a contract already states. Most addresses have nothing to claim in most sources, and the site says so.` },
  { q: "Do I need to connect a wallet?", a: "Not to read. Paste any address. A wallet is needed only to sign a claim yourself or to register, attest or flag a source in the registry." },
  { q: `Does ${BRAND.name} ever send a transaction for me?`, a: "Never. The claim is a transaction your wallet shows you; you sign it or you do not. The site never asks for approvals, permits or seed phrases." },
  { q: "Which sources are supported?", a: "Two are built in today: the Pons creator fee escrow and HoodLock locks. You can also check any Merkle distributor with its proof file, vesting wallets that use owner() and releasable(), and refund contracts that expose a refund view. Registered sources are read by their kind." },
  { q: "What is the simulator?", a: `It runs the exact claim call as an eth_call from the claimer's address on the latest ${CHAIN.name} block. Nothing is signed or sent. It tells you whether the call would succeed or revert, and why.` },
  { q: "What is the source registry?", a: "A small contract where anyone registers a claim source with a rules link and the hash of those rules. Other wallets attest that the rules match the contract or flag it with a reason. One response per wallet, all counts public, nothing hidden, no admin. It is written and tested; until it is deployed the page runs in practice mode in your browser." },
  { q: `What is ${BRAND.symbol}?`, a: `The community token of ${BRAND.name}, launching on Pons on ${CHAIN.name}. It has no promised value and nothing on the site needs it. Analytics credits, premium monitoring and a developer API are planned uses, not live ones.` },
  { q: `How do I buy ${BRAND.symbol}?`, a: `Until the contract address is published on this site and on ${BRAND.xHandle}, there is nothing to buy. After launch, the buy buttons open its page on Pons. Check every character of the address first.` },
  { q: "What does an empty result mean?", a: `That none of the sources ${BRAND.name} reads owes this address anything right now. It says nothing about contracts we do not read.` },
  { q: "Is my data stored?", a: "Addresses you check are sent to our server only to read the chain and to cache answers for a few minutes. Proof files and calldata you paste stay in your browser. Practice registry entries stay in your browser." },
];
