import { BRAND, CHAIN, TOKEN } from "@/config/brand";
import { CONTRACTS, registryLive } from "@/config/contracts";
import { HOODLOCK, PONS_ESCROW } from "@/config/sources";

export const dynamic = "force-static";

/** Plain-text summary for language models and crawlers. */
export function GET() {
  const lines = [
    `# ${BRAND.name}`,
    "",
    `> ${BRAND.slogan} ${BRAND.tagline}`,
    "",
    `${BRAND.name} is a claim discovery and eligibility checker on ${CHAIN.name} (chain id ${CHAIN.id}). It reads supported claim sources only, each with its own read path: the Pons creator fee escrow (${PONS_ESCROW.address}), HoodLock token locks (${HOODLOCK.address}), Merkle distributors checked against the user's own proof file, vesting wallets and refund contracts that expose a refund view, and sources registered in the ${BRAND.name} registry. Every claim can be simulated with eth_call from the user's address before the user's own wallet signs it. ${BRAND.name} never sends a claim, never asks for approvals, is not a tool to recover funds from a hacked wallet, cannot reverse transactions and does not promise free assets.`,
    "",
    "## Pages",
    `- ${BRAND.url}/check: claim check for a wallet (built-in sources + a Merkle proof checker)`,
    `- ${BRAND.url}/sources: every supported source with its contract, rules link and explorer link`,
    `- ${BRAND.url}/simulate: claim simulator (eth_call from your address, nothing sent)`,
    `- ${BRAND.url}/history: claim-related events of a wallet read from chain`,
    `- ${BRAND.url}/refunds: refunds a contract explicitly exposes`,
    `- ${BRAND.url}/registry: on-chain source registry (register, attest, flag)`,
    `- ${BRAND.url}/contracts.json: chain, address and ABI`,
    "",
    "## Contract",
    `- ReclaSourceRegistry: ${registryLive() ? CONTRACTS.registry : "not deployed yet"}`,
    "- register(address source, uint8 kind, string rulesUrl, bytes32 rulesHash, string label); attest(uint256 id); flag(uint256 id, uint8 reason)",
    "- kinds: 1 Merkle, 2 vesting/lock, 3 refund, 4 fee escrow, 5 other. One entry per wallet per source; one response per wallet per entry; flags are counted, nothing is hidden. No owner, no fees, never holds funds.",
    "",
    "## Token",
    `- ${BRAND.symbol}: ${TOKEN.isLive ? BRAND.ca : "not launched yet"}. Community token with no promised value. Analytics credits, premium monitoring and a developer API are planned, not live.`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
