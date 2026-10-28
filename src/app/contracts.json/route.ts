import { BRAND, CHAIN } from "@/config/brand";
import { CONTRACTS, registryLive } from "@/config/contracts";
import { HOODLOCK, PONS_ESCROW } from "@/config/sources";
import { REGISTRY_ABI } from "@/lib/abi";

export const dynamic = "force-static";

/** Machine-readable pointer to the registry (address empty until deployed) and the built-in sources Recla reads. */
export function GET() {
  const body = {
    name: BRAND.name,
    chain: { name: CHAIN.name, id: CHAIN.id, rpc: CHAIN.publicRpc, explorer: CHAIN.explorer },
    contracts: {
      ReclaSourceRegistry: {
        address: registryLive() ? CONTRACTS.registry : null,
        deployedBlock: registryLive() ? CONTRACTS.registryBlock : null,
        status: registryLive() ? "deployed" : "not deployed yet",
        abi: REGISTRY_ABI,
      },
    },
    builtInSources: [
      { name: PONS_ESCROW.name, address: PONS_ESCROW.address, contract: PONS_ESCROW.contractName, views: PONS_ESCROW.views, claims: PONS_ESCROW.claims },
      { name: HOODLOCK.name, address: HOODLOCK.address, contract: HOODLOCK.contractName, views: HOODLOCK.views, claims: HOODLOCK.claims },
    ],
    notes: "Kinds: 1 Merkle, 2 vesting/lock, 3 refund, 4 fee escrow, 5 other. Flag reasons 1-5. No owner, no fees, never holds funds.",
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" } });
}
