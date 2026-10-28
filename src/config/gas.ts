/*
 * Gas used by each ReclaSourceRegistry write, measured with forge (gas report, 30 Oct 2026; upper values: a 200-byte
 * rules URL, a 48-byte label, a wallet's first entry). The site multiplies them by the live gas price for estimates. Robinhood Chain may
 * add a small data fee on top; wallets show the exact figure before signing.
 */
export const GAS = {
  register: 500_000,
  attest: 82_000,
  flag: 105_000,
  deploy: 1_508_199, // anvil chain id 4663, 30 Oct 2026 (forge gas report: 1,507,775)
} as const;

export function gasCostEth(units: number, gasGwei: number | null): number | null {
  if (gasGwei === null || !Number.isFinite(gasGwei)) return null;
  return (units * gasGwei) / 1e9;
}
