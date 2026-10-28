import { isAddress } from "@/config/brand";

/*
 * Recla contract address on Robinhood Chain.
 *   registry  ReclaSourceRegistry, no constructor arguments, no owner, does not need the $RECLA token.
 *             Not deployed yet: the owner deploys it from the local-only /deploy page.
 * Empty => registering, attesting and flagging run in practice mode (signed with your wallet, kept in this browser,
 * nothing sent). Filled => the same buttons send real transactions from the visitor's wallet and every list reads
 * the chain. Check a deployment any time:
 *   npm run verify-deployment -- --registry <address> --registry-tx <tx>
 */
const DEPLOYED = {
  registry: "",
  /** Block of the ReclaSourceRegistry deployment (history reads start here). */
  registryBlock: 0,
};

/**
 * Local fork tests only: NEXT_PUBLIC_RECLA_TEST_CONTRACTS='{"registry":"0x…","registryBlock":1}' at build time points
 * a second build at a contract deployed on an anvil chain. Never set it on Vercel.
 */
function testOverride(): typeof DEPLOYED | null {
  const raw = process.env.NEXT_PUBLIC_RECLA_TEST_CONTRACTS;
  if (!raw) return null;
  try {
    const v = { ...DEPLOYED, ...(JSON.parse(raw) as Partial<typeof DEPLOYED>) };
    return isAddress(v.registry) ? v : null;
  } catch {
    return null;
  }
}

export const CONTRACTS = testOverride() ?? DEPLOYED;

export const registryLive = () => isAddress(CONTRACTS.registry);

export const CONTRACT_NAMES = { registry: "ReclaSourceRegistry" } as const;
