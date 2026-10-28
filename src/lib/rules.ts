import { keccak256, toBytes } from "viem";

/*
 * The registry's input rules, mirrored from ReclaSourceRegistry so the site explains a problem before the wallet is
 * asked to sign, and so practice mode enforces exactly what the contract would. Also the pure practice-mode state
 * machine (used until the registry is deployed).
 */

export const MAX_URL = 200;
export const MAX_LABEL = 48;

export function urlProblem(url: string): string | null {
  const b = new TextEncoder().encode(url);
  if (!url.startsWith("https://") || b.length < 9) return "The rules link must start with https://.";
  if (b.length > MAX_URL) return `The rules link is longer than ${MAX_URL} characters.`;
  for (let i = 8; i < b.length; i++) if (b[i] <= 0x20 || b[i] >= 0x7f) return "The rules link may use plain characters only, no spaces.";
  return null;
}

export function labelProblem(label: string): string | null {
  const b = new TextEncoder().encode(label);
  if (b.length === 0) return "Give the source a short label.";
  if (b.length > MAX_LABEL) return `The label is longer than ${MAX_LABEL} characters.`;
  if (b[0] === 0x20 || b[b.length - 1] === 0x20) return "Remove the space at the start or end of the label.";
  for (const c of b) if (c < 0x20 || c >= 0x7f) return "The label may use plain characters only.";
  return null;
}

/** keccak256 of the rules text exactly as published (UTF-8, no trimming), or the pasted 0x hash itself. */
export function rulesHashOf(textOrHash: string): `0x${string}` | null {
  const t = textOrHash;
  if (/^0x[0-9a-fA-F]{64}$/.test(t.trim())) return t.trim().toLowerCase() as `0x${string}`;
  if (t.length === 0) return null;
  return keccak256(toBytes(t));
}

export type Stance = { s: 1 | 2; r: number };

export type PracticeEntry = {
  id: number;
  source: string;
  kind: number;
  registrant: string;
  rulesUrl: string;
  rulesHash: string;
  label: string;
  at: number;
  attestCount: number;
  flagCount: number;
  stances: Record<string, Stance>;
  /** personal_sign signature of the action that created it (practice proof of intent). */
  sig: string;
};

export type PracticeState = { entries: PracticeEntry[] };

export class RuleError extends Error {}

const low = (a: string) => a.toLowerCase();

export function practiceRegister(
  st: PracticeState,
  who: string,
  e: { source: string; kind: number; rulesUrl: string; rulesHash: string; label: string; sig: string },
  at = Date.now(),
): PracticeState {
  if (!/^0x[0-9a-fA-F]{40}$/.test(e.source)) throw new RuleError("The source must be a 0x address.");
  if (!(e.kind >= 1 && e.kind <= 5)) throw new RuleError("Pick one of the five source kinds.");
  const u = urlProblem(e.rulesUrl);
  if (u) throw new RuleError(u);
  const l = labelProblem(e.label);
  if (l) throw new RuleError(l);
  if (!/^0x[0-9a-fA-F]{64}$/.test(e.rulesHash) || /^0x0{64}$/.test(e.rulesHash)) throw new RuleError("Paste the rules text (or its hash).");
  if (st.entries.some((x) => low(x.registrant) === low(who) && low(x.source) === low(e.source))) throw new RuleError("This wallet already registered that source.");
  const entry: PracticeEntry = { id: st.entries.length + 1, registrant: who, at, attestCount: 0, flagCount: 0, stances: {}, ...e };
  return { entries: [...st.entries, entry] };
}

export function practiceRespond(st: PracticeState, who: string, id: number, stance: 1 | 2, reason = 0): PracticeState {
  const e = st.entries.find((x) => x.id === id);
  if (!e) throw new RuleError("There is no entry with that number.");
  if (low(e.registrant) === low(who)) throw new RuleError("The wallet that registered an entry cannot attest or flag it.");
  if (e.stances[low(who)]) throw new RuleError("This wallet already attested or flagged this entry.");
  if (stance === 2 && !(reason >= 1 && reason <= 5)) throw new RuleError("Pick one of the five flag reasons.");
  const next: PracticeEntry = {
    ...e,
    attestCount: e.attestCount + (stance === 1 ? 1 : 0),
    flagCount: e.flagCount + (stance === 2 ? 1 : 0),
    stances: { ...e.stances, [low(who)]: { s: stance, r: stance === 2 ? reason : 0 } },
  };
  return { entries: st.entries.map((x) => (x.id === id ? next : x)) };
}
