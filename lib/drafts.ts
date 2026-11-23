/**
 * Draft claim checks (CLAUDE.md: "Every drafted claim links to a confirmed fact
 * or source; block approval otherwise").
 *
 * Every sentence in a draft is treated as a claim. A sentence is supported when:
 *  - it states a CONFIRMED fact (found automatically), or
 *  - the customer linked it to a confirmed fact or to an http(s) source.
 * Anything else blocks approval.
 *
 * Pure functions: used by the editor (live feedback) and the server (final check).
 */
import type { ClaimCheck, Fact } from "@/lib/types";

/** A manual link the customer added for one sentence. */
export type ClaimLink = { claimText: string; factId?: string | null; sourceUrl?: string | null };

export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”"’']/g, "")
    .replace(/[^\p{L}\p{N}$.,\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(["with", "from", "that", "this", "your", "their", "have", "about", "into", "than", "more", "every", "built"]);

function stem(w: string): string {
  return w.replace(/(ing|ed|es|s)$/, "");
}

/** Numbers like 5, 50, 1,200, $8, 2019. */
function numbersIn(s: string): string[] {
  return (s.match(/\d[\d,]*(\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
}

function significantTokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .map((w) => w.replace(/[.,$]/g, ""))
    .filter((w) => /^\d+$/.test(w) || (w.length >= 4 && !STOP.has(w)))
    .map(stem);
}

/** Does this sentence state this fact? Conservative: every number must match the fact. */
export function sentenceMatchesFact(sentence: string, fact: Pick<Fact, "value">): boolean {
  const s = normalize(sentence);
  const v = normalize(fact.value);
  if (s.includes(v)) return true;
  const factNums = new Set(numbersIn(fact.value));
  if (numbersIn(sentence).some((n) => !factNums.has(n))) return false; // a number the fact doesn't contain
  const sentenceTokens = new Set(significantTokens(sentence));
  const factTokens = significantTokens(fact.value);
  if (factTokens.length === 0) return false;
  const hits = factTokens.filter((t) => sentenceTokens.has(t)).length;
  return hits / factTokens.length >= 0.7;
}

function isHttpUrl(u: string | null | undefined): u is string {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Checks every sentence of a draft against confirmed facts and manual links. */
export function checkDraftClaims(text: string, facts: Fact[], links: ClaimLink[] = []): ClaimCheck[] {
  const confirmed = facts.filter((f) => f.confirmed && !f.rejected);
  return splitSentences(text).map((claimText) => {
    const link = links.find((l) => l.claimText === claimText);
    if (link?.factId) {
      const fact = confirmed.find((f) => f.id === link.factId);
      if (fact) return { claimText, factId: fact.id, sourceUrl: fact.sourceUrl, supported: true };
    }
    if (isHttpUrl(link?.sourceUrl)) return { claimText, factId: null, sourceUrl: link.sourceUrl, supported: true };
    const fact = confirmed.find((f) => sentenceMatchesFact(claimText, f));
    if (fact) return { claimText, factId: fact.id, sourceUrl: fact.sourceUrl, supported: true };
    return { claimText, factId: null, sourceUrl: null, supported: false };
  });
}

/** Turns a fact into a plain sentence about the brand, e.g. "FlowOps is built for ...". */
export function factSentence(brandName: string, fact: Pick<Fact, "value">): string {
  const v = fact.value.trim().replace(/\.$/, "");
  const first = v.split(/\s+/)[0].toLowerCase();
  const rest = v.charAt(0).toLowerCase() + v.slice(1);
  if (first === "founded") return `${brandName} was ${rest}.`;
  if (/ed$/.test(first) || /^(built|made|run|known)$/.test(first)) return `${brandName} is ${rest}.`; // Built for…, Used by…
  if (/^(team|business|starter|pro)$/.test(first) && /\bcosts?\b/.test(v)) return `${brandName}'s ${v}.`;
  if (/^(integrates|offers|includes|supports|has)$/.test(first)) return `${brandName} ${rest}.`;
  if (/^(free|team|business|starter)\b/.test(first)) return `${brandName} has a ${rest}.`;
  return `${brandName} offers ${rest}.`;
}
