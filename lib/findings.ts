/**
 * Single source of truth for finding labels: text, icon and color.
 * Used by FindingBadge everywhere, so a label looks the same on every screen.
 * Color is never the only signal: every badge has an icon AND a text label.
 */
import { CircleCheck, CircleQuestionMark, EyeOff, Puzzle, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ClaimLabel, FindingKind, GapType } from "@/lib/types";

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
