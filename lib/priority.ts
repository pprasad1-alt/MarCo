/**
 * Priority rules (CLAUDE.md "Corrective action card fields"): buyer relevance 1-3,
 * business impact 1-3, evidence strength high/medium/low. Shared by the snapshot
 * (top findings) and the deep audit (ranked issues).
 */
import type { EvidenceStrength, FindingKind, FocusArea, Issue } from "@/lib/types";

export type IssueKind = Exclude<FindingKind, "accurate">;

export function evidenceStrength(occurrences: number): EvidenceStrength {
  if (occurrences >= 3) return "high";
  if (occurrences === 2) return "medium";
  return "low";
}

const FOCUS_RELEVANCE: Record<FocusArea, 1 | 2 | 3> = {
  pricing_plans: 3,
  comparisons_alternatives: 3,
  product_features: 2,
  use_cases_customers: 2,
  integrations: 2,
  company_credibility: 1,
};

/** Buyer relevance 1-3: discovery questions and pricing/comparisons matter most to buyers. */
export function buyerRelevance(kind: IssueKind, focusArea: FocusArea): 1 | 2 | 3 {
  if (kind === "visibility_gap") return 3;
  return FOCUS_RELEVANCE[focusArea];
}

/** Business impact 1-3: a wrong fact hurts most; an unverifiable claim least. */
export function businessImpact(kind: IssueKind, focusArea: FocusArea): 1 | 2 | 3 {
  switch (kind) {
    case "inaccurate":
      return 3;
    case "visibility_gap":
      return focusArea === "pricing_plans" || focusArea === "comparisons_alternatives" ? 3 : 2;
    case "coverage_gap":
      return 2;
    case "unverifiable":
      return 1;
  }
}

const STRENGTH_WEIGHT: Record<EvidenceStrength, number> = { high: 3, medium: 2, low: 1 };

export function priorityScore(i: Pick<Issue, "relevance" | "impact" | "evidenceStrength">): number {
  return i.relevance * i.impact * STRENGTH_WEIGHT[i.evidenceStrength];
}
