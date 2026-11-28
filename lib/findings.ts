/**
 * Single source of truth for finding labels: text, icon and color.
 * Used by FindingBadge everywhere, so a label looks the same on every screen.
 * Color is never the only signal: every badge has an icon AND a text label.
 */
import { CircleCheck, CircleQuestionMark, EyeOff, Puzzle, TriangleAlert, type LucideIcon } from "lucide-react";
import { FOCUS_AREA_LABELS, type ActionOutcome, type ClaimLabel, type ContentCheckResult, type EvidenceStrength, type FactType, type FindingKind, type FocusArea, type GapType } from "@/lib/types";

type FindingStyle = {
  /** Label once facts are confirmed. */
  label: string;
  /** Label before facts are confirmed (free snapshot). */
  potentialLabel: string;
  icon: LucideIcon;
  /** Tailwind classes; text/background pairs meet WCAG AA contrast. */
  className: string;
  /** One-line plain-English meaning, for legends and tooltips. */
  meaning: string;
};

export const FINDING_STYLES: Record<FindingKind, FindingStyle> = {
  accurate: {
    label: "Accurate",
    potentialLabel: "Potentially accurate",
    icon: CircleCheck,
    className: "bg-green-50 text-green-800 border-green-200",
    meaning: "The AI's claim matches a fact about your company.",
  },
  inaccurate: {
    label: "Inaccurate",
    potentialLabel: "Potential inaccuracy",
    icon: TriangleAlert,
    className: "bg-red-50 text-red-800 border-red-200",
    meaning: "The AI's claim contradicts a confirmed fact.",
  },
  unverifiable: {
    label: "Unverifiable",
    // "Unverifiable" is already a hedged label, so it reads the same in both states.
    potentialLabel: "Unverifiable",
    icon: CircleQuestionMark,
    className: "bg-amber-50 text-amber-900 border-amber-200",
    meaning: "The AI made a claim we can't check against your facts.",
  },
  visibility_gap: {
    label: "Visibility gap",
    potentialLabel: "Potential visibility gap",
    icon: EyeOff,
    className: "bg-blue-50 text-blue-800 border-blue-200",
    meaning: "Your brand wasn't included in the answer. A missing mention, not an error.",
  },
  coverage_gap: {
    label: "Coverage gap",
    potentialLabel: "Potential coverage gap",
    icon: Puzzle,
    className: "bg-violet-50 text-violet-800 border-violet-200",
    meaning: "A relevant fact about you was left out. A missing detail, not an error.",
  },
};

export function findingLabel(kind: FindingKind, potential: boolean): string {
  const style = FINDING_STYLES[kind];
  return potential ? style.potentialLabel : style.label;
}

export function findingKindForClaim(label: ClaimLabel): FindingKind {
  return label;
}

export function findingKindForGap(type: GapType): FindingKind {
  return type === "visibility" ? "visibility_gap" : "coverage_gap";
}

/** Plain-language names for action outcomes. */
export const OUTCOME_LABELS: Record<ActionOutcome, string> = {
  correction: "Correction recommended",
  investigate: "Further investigation needed",
  no_correction: "No correction recommended",
};

export const CONTENT_CHECK_LABELS: Record<ContentCheckResult, string> = {
  stated_clearly: "Your website already states this clearly",
  stated_unclearly: "Your website mentions this, but not clearly",
  not_stated: "Your website doesn't state this",
  not_applicable: "Not about one of your facts",
};

export const STRENGTH_LABELS: Record<EvidenceStrength, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Every fact belongs to one of the six focus areas. */
export const FACT_TYPE_FOCUS: Record<FactType, FocusArea> = {
  product_feature: "product_features",
  pricing: "pricing_plans",
  integration: "integrations",
  competitor_positioning: "comparisons_alternatives",
  use_case: "use_cases_customers",
  customer: "use_cases_customers",
  company: "company_credibility",
  other: "product_features",
};

/** Fact labels use the focus area names (e.g. "Pricing and plans"). */
export const FACT_TYPE_LABELS: Record<FactType, string> = Object.fromEntries(
  Object.entries(FACT_TYPE_FOCUS).map(([type, area]) => [type, FOCUS_AREA_LABELS[area]]),
) as Record<FactType, string>;

/** One line per focus area, shown on the focus area picker. */
export const FOCUS_AREA_DESCRIPTIONS: Record<FocusArea, string> = {
  product_features: "What AI says your product does.",
  pricing_plans: "Plans, prices and free tiers, and whether you show up when buyers compare costs.",
  integrations: "Which tools AI says you connect with.",
  comparisons_alternatives: "Whether you're named next to competitors and as an alternative.",
  use_cases_customers: "Who AI says you're for, and which customers it mentions.",
  company_credibility: "Your founding story, location and track record.",
};
