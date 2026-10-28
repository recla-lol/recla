import { parseAbi, type Abi } from "viem";

/*
 * ABIs the site needs. REGISTRY_ABI mirrors contracts/src/ReclaSourceRegistry.sol (src/lib/abi.test.ts checks it
 * against the compiled artifact so the two cannot drift apart). ESCROW_ABI and LOCKER_ABI are the parts of the
 * verified Pons fee escrow and HoodLock locker sources that Recla reads (Sourcify, chain 4663).
 */
export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

export const FEED_ABI = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

export const REGISTRY_ABI = parseAbi([
  "struct EntryView { uint256 id; address source; uint8 kind; address registrant; uint64 registeredBlock; uint64 registeredAt; uint32 attestCount; uint32 flagCount; bytes32 rulesHash; string rulesUrl; string label; }",
  "function KIND_MERKLE() view returns (uint8)",
  "function KIND_VESTING() view returns (uint8)",
  "function KIND_REFUND() view returns (uint8)",
  "function KIND_ESCROW() view returns (uint8)",
  "function KIND_OTHER() view returns (uint8)",
  "function MAX_REASON() view returns (uint8)",
  "function MAX_URL_LENGTH() view returns (uint256)",
  "function MAX_LABEL_LENGTH() view returns (uint256)",
  "function MAX_PAGE() view returns (uint256)",
  "function STANCE_NONE() view returns (uint8)",
  "function STANCE_ATTEST() view returns (uint8)",
  "function STANCE_FLAG() view returns (uint8)",
  "function register(address source, uint8 kind, string rulesUrl, bytes32 rulesHash, string label) returns (uint256 id)",
  "function attest(uint256 id)",
  "function flag(uint256 id, uint8 reason)",
  "function entryCount() view returns (uint256)",
  "function attestTotal() view returns (uint256)",
  "function flagTotal() view returns (uint256)",
  "function getEntry(uint256 id) view returns (EntryView v)",
  "function entries(uint256 fromId, uint256 limit) view returns (EntryView[] out)",
  "function entryCountForSource(address source) view returns (uint256)",
  "function entryIdsForSource(address source, uint256 offset, uint256 limit) view returns (uint256[])",
  "function entryCountOf(address registrant) view returns (uint256)",
  "function entryIdsOf(address registrant, uint256 offset, uint256 limit) view returns (uint256[])",
  "function entryIdOf(address registrant, address source) view returns (uint256)",
  "function stanceOf(uint256 id, address wallet) view returns (uint8 stance, uint8 reason)",
  "function chainBlock() view returns (uint64)",
  "event SourceRegistered(uint256 indexed id, address indexed source, address indexed registrant, uint8 kind, bytes32 rulesHash, string rulesUrl, string label, uint64 chainBlock)",
  "event Attested(uint256 indexed id, address indexed wallet, uint32 attestCount, uint64 chainBlock)",
  "event Flagged(uint256 indexed id, address indexed wallet, uint8 reason, uint32 flagCount, uint64 chainBlock)",
  "error NotAContract(address source)",
  "error BadKind(uint8 kind)",
  "error BadUrl()",
  "error BadLabel()",
  "error BadRulesHash()",
  "error AlreadyRegistered(uint256 id)",
  "error UnknownEntry(uint256 id)",
  "error OwnEntry(uint256 id)",
  "error AlreadyResponded(uint256 id, uint8 stance)",
  "error BadReason(uint8 reason)",
]);

/** Pons V2 fee escrow (0xd3AF…Ac9e), the parts Recla reads and simulates. */
export const ESCROW_ABI = parseAbi([
  "function balanceOf(address recipient) view returns (uint256)",
  "function balanceOfToken(address recipient, address token) view returns (uint256)",
  "function claim() returns (uint256 amount)",
  "function claimToken(address token) returns (uint256 amount)",
  "event Claimed(address indexed recipient, uint256 amount)",
  "event ClaimedToken(address indexed recipient, address indexed token, uint256 amount)",
  "event Credited(address indexed recipient, address indexed depositor, uint256 amount)",
  "event CreditedToken(address indexed recipient, address indexed token, address indexed depositor, uint256 amount)",
  "error InsufficientBalance(uint256 available, uint256 requested)",
  "error NoBalance()",
  "error ReentrancyGuardReentrantCall()",
  "error SafeERC20FailedOperation(address token)",
  "error TransferFailed()",
  "error ZeroAddress()",
]);

/** HoodLock locker (RobinhoodLocker, 0xD0f7…C32F). */
export const LOCKER_ABI = parseAbi([
  "struct Lock { address owner; address token; uint256 amount; uint256 unlockTime; bool withdrawn; }",
  "function locksByOwner(address o) view returns (uint256[])",
  "function getLock(uint256 id) view returns (Lock)",
  "function isUnlocked(uint256 id) view returns (bool)",
  "function timeRemaining(uint256 id) view returns (uint256)",
  "function nextLockId() view returns (uint256)",
  "function withdraw(uint256 id)",
  "event Locked(uint256 indexed id, address indexed owner, address indexed token, uint256 amount, uint256 unlockTime)",
  "event Withdrawn(uint256 indexed id, address indexed owner, uint256 amount)",
]);

/** The common Merkle distributor shape (index, account, amount, proof). */
export const MERKLE_ABI = parseAbi([
  "function token() view returns (address)",
  "function merkleRoot() view returns (bytes32)",
  "function isClaimed(uint256 index) view returns (bool)",
  "function claim(uint256 index, address account, uint256 amount, bytes32[] merkleProof)",
  "event Claimed(uint256 index, address account, uint256 amount)",
]);

/** Vesting wallet shape (OpenZeppelin VestingWallet): the beneficiary is owner(). */
export const VESTING_ABI = parseAbi([
  "function owner() view returns (address)",
  "function start() view returns (uint256)",
  "function duration() view returns (uint256)",
  "function end() view returns (uint256)",
  "function released() view returns (uint256)",
  "function released(address token) view returns (uint256)",
  "function releasable() view returns (uint256)",
  "function releasable(address token) view returns (uint256)",
  "function release()",
  "function release(address token)",
  "event EtherReleased(uint256 amount)",
  "event ERC20Released(address indexed token, uint256 amount)",
]);

/** Refund views Recla probes on a registered refund source. A contract with other names is "not readable". */
export const REFUND_ABI = parseAbi([
  "function refundOf(address account) view returns (uint256)",
  "function refundable(address account) view returns (uint256)",
  "function refunds(address account) view returns (uint256)",
  "function claimRefund()",
  "function refund()",
]);

const errorsOf = (abi: Abi) => abi.filter((x) => x.type === "error");
export const ALL_ERRORS: Abi = [...errorsOf(REGISTRY_ABI as Abi), ...errorsOf(ESCROW_ABI as Abi)];

/** Plain words for each custom error, shown instead of a selector. */
export const ERROR_WORDS: Record<string, string> = {
  NotAContract: "That address holds no contract code on Robinhood Chain. Only contracts can be registered as claim sources.",
  BadKind: "Pick one of the five source kinds.",
  BadUrl: "The rules link must start with https:// and use plain characters only (no spaces), up to 200 characters.",
  BadLabel: "The label is 1 to 48 plain characters, without leading or trailing spaces.",
  BadRulesHash: "Paste the rules text (or its keccak256 hash) so the entry can be compared later.",
  AlreadyRegistered: "This wallet already registered that source. Open the existing entry instead.",
  UnknownEntry: "There is no entry with that number.",
  OwnEntry: "The wallet that registered an entry cannot attest or flag it.",
  AlreadyResponded: "This wallet already attested or flagged this entry. One response per wallet per entry.",
  BadReason: "Pick one of the five flag reasons.",
  NoBalance: "Nothing to claim: the escrow holds no balance for this address.",
  InsufficientBalance: "The amount asked for is more than the escrow holds for this address.",
  TransferFailed: "The escrow could not send the payment to this address.",
  ZeroAddress: "A zero address was passed where a real one is needed.",
  ReentrancyGuardReentrantCall: "The escrow refused a nested call.",
  SafeERC20FailedOperation: "The token transfer inside the claim failed.",
};
