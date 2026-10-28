import { encodeAbiParameters, encodePacked, getAddress, isAddress, keccak256, type Hex } from "viem";

/*
 * Merkle claims, checked in the browser. Recla never builds a tree for anyone: the user pastes the proof file the
 * distributor published, and this module (1) finds the user's leaf, (2) recomputes the root from the proof and
 * (3) compares it with the root the contract stores. Supported files:
 *   - the common distributor output: { merkleRoot, claims: { "0xAccount": { index, amount, proof } } }
 *   - a single claim: { index, account, amount, proof }
 *   - an OpenZeppelin StandardMerkleTree dump: { format: "standard-v1", tree, values, leafEncoding }
 * Pairs are hashed sorted (OpenZeppelin MerkleProof), which is what both formats use.
 */

export type Claim = {
  format: "distributor" | "standard";
  account: `0x${string}`;
  /** Leaf index (distributor format) or value index (standard format). */
  index: bigint;
  amount: bigint;
  proof: Hex[];
  leaf: Hex;
  /** Root stated in the file, if any. */
  fileRoot: Hex | null;
  /** Standard format only: the raw leaf values and their encoding. */
  values?: unknown[];
  encoding?: string[];
};

export class ProofError extends Error {}

const isHash = (v: unknown): v is Hex => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);

/** Amounts appear as decimal strings, hex strings or JSON numbers (only exact integers are accepted). */
export function toBig(v: unknown, what: string): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return BigInt(v);
  if (typeof v === "string" && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(v.trim())) return BigInt(v.trim());
  throw new ProofError(`${what} is not a whole number.`);
}

/** keccak(a, b) with the pair sorted, as OpenZeppelin MerkleProof does. */
export function hashPair(a: Hex, b: Hex): Hex {
  return BigInt(a) < BigInt(b) ? keccak256(`0x${a.slice(2)}${b.slice(2)}`) : keccak256(`0x${b.slice(2)}${a.slice(2)}`);
}

export function rootFrom(leaf: Hex, proof: Hex[]): Hex {
  return proof.reduce<Hex>((h, p) => hashPair(h, p), leaf);
}

/** Leaf of the common distributor: keccak256(abi.encodePacked(uint256 index, address account, uint256 amount)). */
export const distributorLeaf = (index: bigint, account: `0x${string}`, amount: bigint) =>
  keccak256(encodePacked(["uint256", "address", "uint256"], [index, account, amount]));

/** Leaf of a StandardMerkleTree: keccak256(bytes.concat(keccak256(abi.encode(values)))). */
export function standardLeaf(encoding: string[], values: unknown[]): Hex {
  const inner = keccak256(encodeAbiParameters(encoding.map((type) => ({ type })), values as never));
  return keccak256(inner);
}

const MAX_FILE = 5 * 1024 * 1024;

/** Finds `account`'s claim in a pasted proof file. Throws ProofError with a plain reason. */
export function findClaim(text: string, account: string): Claim {
  if (!isAddress(account, { strict: false })) throw new ProofError("Connect a wallet or paste the address to check first.");
  if (text.length > MAX_FILE) throw new ProofError("The proof file is larger than 5 MB; paste only your own claim entry.");
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new ProofError("The proof file is not valid JSON.");
  }
  if (!j || typeof j !== "object") throw new ProofError("The proof file is not a JSON object.");
  const o = j as Record<string, unknown>;
  const me = getAddress(account);

  // OpenZeppelin StandardMerkleTree dump.
  if (o.format === "standard-v1" && Array.isArray(o.tree) && Array.isArray(o.values) && Array.isArray(o.leafEncoding)) {
    const encoding = o.leafEncoding as string[];
    const at = encoding.indexOf("address");
    if (at < 0) throw new ProofError("This tree's leaves hold no address, so Recla cannot tell which one is yours.");
    const amountAt = encoding.findIndex((t, i) => i !== at && /^uint/.test(t));
    const tree = o.tree as unknown[];
    if (!tree.every(isHash)) throw new ProofError("The tree holds entries that are not 32-byte hashes.");
    const values = o.values as { value: unknown[]; treeIndex: number }[];
    const k = values.findIndex((v) => Array.isArray(v?.value) && typeof v.value[at] === "string" && isAddress(v.value[at] as string, { strict: false }) && getAddress(v.value[at] as string) === me);
    if (k < 0) throw new ProofError("This address is not in the tree. The file lists every eligible address, so this one is not eligible for this distribution.");
    const entry = values[k];
    let i = entry.treeIndex;
    if (!Number.isInteger(i) || i < 0 || i >= tree.length) throw new ProofError("The tree index of this entry is out of range.");
    const leaf = standardLeaf(encoding, entry.value);
    if ((tree[i] as string).toLowerCase() !== leaf.toLowerCase()) throw new ProofError("The leaf in the tree does not match its own values; the file was changed.");
    const proof: Hex[] = [];
    while (i > 0) {
      const sibling = i % 2 === 1 ? i + 1 : i - 1;
      if (sibling < tree.length) proof.push(tree[sibling] as Hex);
      i = (i - 1) >> 1;
    }
    return {
      format: "standard",
      account: me,
      index: BigInt(k),
      amount: amountAt >= 0 ? toBig(entry.value[amountAt], "Amount") : 0n,
      proof,
      leaf,
      fileRoot: tree[0] as Hex,
      values: entry.value,
      encoding,
    };
  }

  // Distributor output with a claims map, or a single claim.
  let item: Record<string, unknown> | null = null;
  let fileRoot: Hex | null = isHash(o.merkleRoot) ? (o.merkleRoot as Hex) : null;
  if (o.claims && typeof o.claims === "object" && !Array.isArray(o.claims)) {
    const claims = o.claims as Record<string, unknown>;
    const key = Object.keys(claims).find((a) => isAddress(a, { strict: false }) && getAddress(a) === me);
    if (!key) throw new ProofError("This address is not in the file. The file lists every eligible address, so this one is not eligible for this distribution.");
    item = claims[key] as Record<string, unknown>;
  } else if (Array.isArray(o.claims)) {
    item = (o.claims as Record<string, unknown>[]).find((c) => typeof c?.account === "string" && isAddress(c.account, { strict: false }) && getAddress(c.account) === me) ?? null;
    if (!item) throw new ProofError("This address is not in the file.");
  } else if ("proof" in o && "amount" in o) {
    item = o;
    if (typeof o.account === "string" && isAddress(o.account, { strict: false }) && getAddress(o.account) !== me) throw new ProofError("This claim entry belongs to another address.");
  }
  if (!item) throw new ProofError("Recla does not recognise this file. Supported: a distributor file with a claims map, a single claim, or a StandardMerkleTree dump.");
  if (!fileRoot && isHash(item.merkleRoot)) fileRoot = item.merkleRoot as Hex;
  const index = toBig(item.index, "Index");
  const amount = toBig(item.amount, "Amount");
  const proof = item.proof;
  if (!Array.isArray(proof) || !proof.every(isHash)) throw new ProofError("The proof must be a list of 32-byte hashes.");
  if (proof.length > 64) throw new ProofError("The proof is longer than 64 steps.");
  return { format: "distributor", account: me, index, amount, proof: proof as Hex[], leaf: distributorLeaf(index, me, amount), fileRoot };
}

/** Root this claim's proof leads to. */
export const claimRoot = (c: Claim) => rootFrom(c.leaf, c.proof);
