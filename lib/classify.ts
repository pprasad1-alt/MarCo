/**
 * Classification rules (CLAUDE.md "Classification").
 *
 * Split of responsibilities:
 *  - The AI (or mock fixture) produces an AnswerAnalysis: which sentences are
 *    claims and which fact each one relates to. That is *evidence*, not a verdict.
 *  - This file applies the rules in code to decide labels, so the rules are
 *    deterministic and covered by tests.
 *
 * Rules:
 *  - Claims: accurate | inaccurate (contradicts a fact) | unverifiable (no matching fact).
 *  - Omissions are gaps, never claims, so an omission can never be "inaccurate".
 *    Visibility gap: a discovery answer doesn't include the brand.
 *    Coverage gap: a fact relevant to the question isn't mentioned.
 *  - Until facts are confirmed, every finding is "potential".
 *  - Citations play no part in the label: no citations = "citation evidence
 *    unavailable", never "inaccurate".
 */
import { z } from "zod";
import { mentionsBrand } from "@/lib/prompts";
import type { AuditRun, Claim, Fact, Gap, Prompt } from "@/lib/types";

export const AnswerAnalysis = z.object({
  claims: z.array(
    z.object({
      /** The AI's exact words (must appear in the answer). */
      excerpt: z.string().min(1),
      /** The fact this claim is about, if any. */
      factId: z.string().nullable(),
      /** supports = matches the fact; contradicts = conflicts with it; none = no fact to check against. */
      relation: z.enum(["supports", "contradicts", "none"]),
    }),
  ),
  /** Facts a good answer to THIS question would mention (for coverage gaps). */
  relevantFactIds: z.array(z.string()),
});
export type AnswerAnalysis = z.infer<typeof AnswerAnalysis>;

export type ClassifyInput = {
  run: Pick<AuditRun, "id" | "answer">;
  prompt: Pick<Prompt, "type">;
  brandName: string;
  facts: Fact[];
  analysis: AnswerAnalysis;
  /**
   * True once the customer has reviewed their facts (deep audits). Then only
   * findings that rely on a still-unconfirmed fact stay "potential".
   * Defaults to "every fact is confirmed".
   */
  factsReviewed?: boolean;
};

/** Findings are "potential" unless the facts they rely on are confirmed. */
export function factsAreConfirmed(facts: Fact[]): boolean {
  return facts.length > 0 && facts.every((f) => f.confirmed);
}

export function classifyAnswer({ run, prompt, brandName, facts: allFacts, analysis, factsReviewed }: ClassifyInput): {
  claims: Claim[];
  gaps: Gap[];
} {
  const answer = run.answer ?? "";
  // Facts the customer rejected are never used to judge a claim.
  const facts = allFacts.filter((f) => !f.rejected);
  const factById = new Map(facts.map((f) => [f.id, f]));
  const reviewed = factsReviewed ?? factsAreConfirmed(facts);

  const claims: Claim[] = analysis.claims.map((c, i) => {
    const fact = c.factId ? factById.get(c.factId) : undefined;
    let label: Claim["label"];
    if (!fact || c.relation === "none") {
      label = "unverifiable"; // nothing to check it against
    } else if (c.relation === "supports") {
      label = "accurate";
    } else {
      label = "inaccurate"; // contradicts a fact: shown as "Potential inaccuracy" until confirmed
    }
    const matched = label === "unverifiable" ? undefined : fact;
    return {
      id: `${run.id}-c${i + 1}`,
      auditRunId: run.id,
      answerExcerpt: c.excerpt,
      label,
      potential: !reviewed || (matched ? !matched.confirmed : false),
      matchedFactId: matched?.id ?? null,
      matchedFactVersion: matched?.version ?? null,
      verifiedSourceUrl: matched?.confirmed ? matched.sourceUrl : null,
    };
  });

  const gaps: Gap[] = [];

  // Visibility gap: discovery answer that leaves the brand out.
  if (prompt.type === "discovery" && answer && !mentionsBrand(answer, brandName)) {
    gaps.push({
      id: `${run.id}-g${gaps.length + 1}`,
      auditRunId: run.id,
      type: "visibility",
      expected: brandName,
      expectedFactId: null,
      potential: !reviewed,
    });
  }

  // Coverage gap: a relevant fact the answer didn't address at all.
  const addressed = new Set(claims.map((c) => c.matchedFactId).filter(Boolean));
  for (const factId of analysis.relevantFactIds) {
    const fact = factById.get(factId);
    if (!fact || addressed.has(factId)) continue;
    gaps.push({
      id: `${run.id}-g${gaps.length + 1}`,
      auditRunId: run.id,
      type: "coverage",
      expected: fact.value,
      expectedFactId: fact.id,
      potential: !reviewed || !fact.confirmed,
    });
  }

  return { claims, gaps };
}
