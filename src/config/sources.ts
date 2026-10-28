/*
 * Built-in claim sources. Each one is a real contract on Robinhood Chain whose read path was confirmed from its
 * verified source (Sourcify, chain 4663) and with eth_call on 30 Oct 2026. Nothing here is a partner list: these are
 * public contracts Recla knows how to read. Anything else comes from the ReclaSourceRegistry or is pasted by the user.
 */

export const PONS_ESCROW = {
  key: "pons-escrow",
  name: "Pons creator fee escrow",
  address: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",
  contractName: "PonsV2FeeEscrow",
  /** Creation block (Sourcify deployment record). History reads start here. */
  deployBlock: 26_841_845,
  rulesUrl: "https://ponsfamily.com",
  /** What the source pays and who may claim. */
  summary:
    "Creator fees from Pons launches are credited here to each token's creator fee recipient. The recipient claims ETH with claim(), or a pair token (USDG, stock tokens) with claimToken(token).",
  views: ["balanceOf(address)", "balanceOfToken(address,address)"],
  claims: ["claim()", "claimToken(address)"],
  events: ["Claimed(address indexed recipient, uint256 amount)", "ClaimedToken(address indexed recipient, address indexed token, uint256 amount)", "Credited(address indexed recipient, address indexed depositor, uint256 amount)", "CreditedToken(address indexed recipient, address indexed token, address indexed depositor, uint256 amount)"],
} as const;

export const HOODLOCK = {
  key: "hoodlock",
  name: "HoodLock token locks",
  address: "0xD0f7d8c6e9f6D80c297bEbe4F7fD1B9C8125C32F",
  contractName: "RobinhoodLocker",
  deployBlock: 4_591_195,
  rulesUrl: "https://hoodlock.tech",
  proofUrl: (id: number | bigint) => `https://hoodlock.tech/proof/lock/${id}`,
  summary:
    "Token locks: a wallet locks tokens until an unlock time and withdraws them itself afterwards with withdraw(id). Only the lock owner can withdraw; nothing is paid before the unlock time. The locker itself has an admin who can change its locking fee (a HoodLock setting, not a Recla one).",
  views: ["locksByOwner(address)", "getLock(uint256)", "isUnlocked(uint256)", "timeRemaining(uint256)"],
  claims: ["withdraw(uint256)"],
  events: ["Locked(uint256 indexed id, address indexed owner, address indexed token, uint256 amount, uint256 unlockTime)", "Withdrawn(uint256 indexed id, address indexed owner, uint256 amount)"],
} as const;

/** Kinds used by the registry contract (KIND_* constants) and by the site's read paths. */
export const KINDS = [
  { code: 1, key: "merkle", label: "Merkle distributor", read: "isClaimed(index) + merkleRoot(); your proof is checked in the browser" },
  { code: 2, key: "vesting", label: "Vesting / lock", read: "releasable(token) / releasable() on a vesting wallet" },
  { code: 3, key: "refund", label: "Refund", read: "refundOf / refundable / refunds (address), if the contract exposes one" },
  { code: 4, key: "escrow", label: "Fee escrow", read: "balanceOf(address) on an escrow that pays with claim()" },
  { code: 5, key: "other", label: "Other", read: "listed and checked for code only; Recla does not read it" },
] as const;

export const kindLabel = (code: number) => KINDS.find((k) => k.code === code)?.label ?? `Kind ${code}`;

/** Flag reasons (registry MAX_REASON = 5). */
export const REASONS = [
  { code: 1, label: "Rules do not match the contract" },
  { code: 2, label: "Rules link is broken" },
  { code: 3, label: "Impersonates another project" },
  { code: 4, label: "Asks for an approval or a payment to claim" },
  { code: 5, label: "Other" },
] as const;

export const reasonLabel = (code: number) => REASONS.find((r) => r.code === code)?.label ?? `Reason ${code}`;
