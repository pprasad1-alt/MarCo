/**
 * MarCo data types.
 *
 * Each record has a zod schema (used to validate data, e.g. Gemini's JSON
 * output) and a TypeScript type inferred from it, so the two never drift.
 * Field names mirror the planned Supabase tables (see CLAUDE.md / build plan)
 * in camelCase; the database layer maps them to snake_case columns later.
 *
 * Mock and real code paths must both return these exact types.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

export const Id = z.string().min(1);
/** ISO 8601 timestamp string, e.g. "2026-11-22T21:00:00.000Z". */
export const Timestamp = z.iso.datetime();
export const HttpUrl = z.url({ protocol: /^https?$/ });

export const FOCUS_AREAS = [
  "product_features",
  "pricing_plans",
  "integrations",
  "comparisons_alternatives",
  "use_cases_customers",
  "company_credibility",
] as const;
export const FocusArea = z.enum(FOCUS_AREAS);
export type FocusArea = z.infer<typeof FocusArea>;

/** Plain-language names for focus areas (sentence case). */
export const FOCUS_AREA_LABELS: Record<FocusArea, string> = {
  product_features: "Product and features",
  pricing_plans: "Pricing and plans",
  integrations: "Integrations",
  comparisons_alternatives: "Comparisons and alternatives",
  use_cases_customers: "Use cases and customers",
  company_credibility: "Company and credibility",
};

/** Discovery/comparison questions NEVER name the brand. */
export const QuestionType = z.enum(["discovery", "fact_verification"]);
export type QuestionType = z.infer<typeof QuestionType>;

export const AuditType = z.enum(["snapshot", "deep", "re_audit"]);
export type AuditType = z.infer<typeof AuditType>;

export const Mode = z.enum(["MOCK", "SIMULATION", "GEMINI_AUDIT"]);

export const ClaimLabel = z.enum(["accurate", "inaccurate", "unverifiable"]);
export type ClaimLabel = z.infer<typeof ClaimLabel>;

export const GapType = z.enum(["visibility", "coverage"]);
export type GapType = z.infer<typeof GapType>;

export const Score1to3 = z.number().int().min(1).max(3);
export const EvidenceStrength = z.enum(["high", "medium", "low"]);
export type EvidenceStrength = z.infer<typeof EvidenceStrength>;

/** Published is set ONLY by the customer. */
export const ACTION_STATUSES = ["Draft", "In review", "Approved", "Exported", "Published"] as const;
export const ActionStatus = z.enum(ACTION_STATUSES);
export type ActionStatus = z.infer<typeof ActionStatus>;

/**
 * What the UI shows on a finding badge. Before facts are confirmed (free
 * snapshot), badges add "Potential", e.g. "Potential inaccuracy".
 * Omissions (gaps) are never errors.
 */
export const FINDING_KINDS = [
  "accurate",
  "inaccurate",
  "unverifiable",
  "visibility_gap",
  "coverage_gap",
] as const;
export const FindingKind = z.enum(FINDING_KINDS);
export type FindingKind = z.infer<typeof FindingKind>;

// ---------------------------------------------------------------------------
// brands
// ---------------------------------------------------------------------------

export const Brand = z.object({
  id: Id,
  url: HttpUrl,
  name: z.string().min(1),
  category: z.string().min(1),
  competitors: z.array(z.string().min(1)),
  /** User id; null for anonymous free snapshots. */
  ownerId: Id.nullable(),
  createdAt: Timestamp,
  /** When the customer finished reviewing facts. Until then, every finding is "potential". */
  factsReviewedAt: Timestamp.nullable().optional(),
});
export type Brand = z.infer<typeof Brand>;

// ---------------------------------------------------------------------------
// facts
// ---------------------------------------------------------------------------

export const FactType = z.enum([
  "product_feature",
  "pricing",
  "integration",
  "competitor_positioning",
  "use_case",
  "customer",
  "company",
  "other",
]);
export type FactType = z.infer<typeof FactType>;

export const Fact = z.object({
  id: Id,
  brandId: Id,
  factType: FactType,
  value: z.string().min(1),
  /** Page the fact was extracted from. */
  sourceUrl: HttpUrl,
  /** Only confirmed facts can make a claim "inaccurate". */
  confirmed: z.boolean(),
  version: z.number().int().min(1),
  confirmedAt: Timestamp.nullable(),
  /** The customer said this fact is wrong; it is never used to check claims. */
  rejected: z.boolean().optional(),
});
export type Fact = z.infer<typeof Fact>;

/** Shape Gemini must return when extracting facts (before ids are assigned). */
export const ExtractedFact = Fact.pick({ factType: true, value: true, sourceUrl: true });
export type ExtractedFact = z.infer<typeof ExtractedFact>;

// ---------------------------------------------------------------------------
// prompts (versioned question library)
// ---------------------------------------------------------------------------

export const Prompt = z.object({
  id: Id,
  focusArea: FocusArea,
  type: QuestionType,
  /** e.g. "What are the best {category} tools for a 20-person startup?" */
  questionTemplate: z.string().min(1),
  version: z.number().int().min(1),
});
export type Prompt = z.infer<typeof Prompt>;

// ---------------------------------------------------------------------------
// audits and audit_runs
// ---------------------------------------------------------------------------

export const Audit = z.object({
  id: Id,
  brandId: Id,
  type: AuditType,
  /** Null for the free snapshot, which spans several focus areas. */
  focusArea: FocusArea.nullable(),
  /** For re-audits: the audit being compared against. */
  baselineAuditId: Id.nullable(),
  createdAt: Timestamp,
  /** The mode this audit runs in, fixed at the start so it never switches halfway. */
  mode: Mode.optional(),
});
export type Audit = z.infer<typeof Audit>;

/** A citation exactly as the API returned it (not yet verified). */
export const RawCitation = z.object({
  url: z.string(),
  title: z.string().optional(),
});
export type RawCitation = z.infer<typeof RawCitation>;

export const AuditRunStatus = z.enum(["pending", "running", "completed", "failed"]);
export type AuditRunStatus = z.infer<typeof AuditRunStatus>;

export const AuditRun = z.object({
  id: Id,
  auditId: Id,
  promptId: Id,
  promptVersion: z.number().int().min(1),
  /** The exact question sent, with category/competitors filled in. */
  promptText: z.string().min(1),
  runNumber: z.number().int().min(1),
  /** Which mode produced this answer, so results are always labeled. */
  mode: Mode,
  modelId: z.string().min(1),
  groundingSettings: z.record(z.string(), z.unknown()),
  generationSettings: z.record(z.string(), z.unknown()),
  timestamp: Timestamp,
  /** Full AI answer; null until the run completes. */
  answer: z.string().nullable(),
  /** Empty array = "citation evidence unavailable" (never means inaccurate). */
  rawCitations: z.array(RawCitation),
  status: AuditRunStatus,
  /** Plain-language error if status is "failed". Never replaced by invented results. */
  error: z.string().nullable().optional(),
});
export type AuditRun = z.infer<typeof AuditRun>;

// ---------------------------------------------------------------------------
// claims and gaps (classification)
// ---------------------------------------------------------------------------

export const Claim = z.object({
  id: Id,
  auditRunId: Id,
  /** The AI's exact words. */
  answerExcerpt: z.string().min(1),
  label: ClaimLabel,
  /** True before facts are confirmed: shown as "Potential ...". */
  potential: z.boolean(),
  matchedFactId: Id.nullable(),
  matchedFactVersion: z.number().int().min(1).nullable(),
  /** A source verified as supporting/contradicting the claim (separate from raw citations). */
  verifiedSourceUrl: HttpUrl.nullable(),
});
export type Claim = z.infer<typeof Claim>;

export const Gap = z.object({
  id: Id,
  auditRunId: Id,
  type: GapType,
  /** Visibility gap: the brand name. Coverage gap: the missing fact, in words. */
  expected: z.string().min(1),
  /** Coverage gaps: the fact that was missing. */
  expectedFactId: Id.nullable(),
  potential: z.boolean(),
});
export type Gap = z.infer<typeof Gap>;

// ---------------------------------------------------------------------------
// issues, actions, drafts (diagnosis -> correction)
// ---------------------------------------------------------------------------

export const Issue = z.object({
  id: Id,
  auditId: Id,
  /** What finding type this issue groups (claims of one label, or gaps of one type). */
  kind: FindingKind,
  /** "Observed issue" in plain words, e.g. "AI says your free plan covers 10 users". */
  observedIssue: z.string().min(1),
  claimIds: z.array(Id),
  gapIds: z.array(Id),
  evidenceExcerpt: z.string().min(1),
  /** Buyer relevance, 1 (low) to 3 (high). */
  relevance: Score1to3,
  /** Business impact, 1 (low) to 3 (high). */
  impact: Score1to3,
  evidenceStrength: EvidenceStrength,
  rejectedByUser: z.boolean(),
});
export type Issue = z.infer<typeof Issue>;

/** Does the website already state the fact clearly? */
/** not_applicable: the issue isn't about one of your facts (e.g. you weren't mentioned at all). */
export const ContentCheckResult = z.enum(["stated_clearly", "stated_unclearly", "not_stated", "not_applicable"]);
export type ContentCheckResult = z.infer<typeof ContentCheckResult>;

/** "No correction recommended" and "Further investigation needed" are valid outcomes. */
export const ActionOutcome = z.enum(["correction", "no_correction", "investigate"]);
export type ActionOutcome = z.infer<typeof ActionOutcome>;

export const Action = z.object({
  id: Id,
  issueId: Id,
  contentCheckResult: ContentCheckResult,
  /** Where the fix should go, e.g. "Pricing page", "Integrations FAQ". */
  destination: z.string().min(1),
  outcome: ActionOutcome,
  /** What the content check found, in plain words (e.g. which page states the fact). */
  contentCheckNote: z.string().optional(),
  /** The recommendation in plain words (or the no-action explanation). */
  recommendedAction: z.string().min(1),
  reason: z.string().min(1),
  status: ActionStatus,
});
export type Action = z.infer<typeof Action>;

/** Every drafted claim must link to a confirmed fact or a source. */
export const ClaimCheck = z.object({
  claimText: z.string().min(1),
  factId: Id.nullable(),
  sourceUrl: HttpUrl.nullable(),
  supported: z.boolean(),
});
export type ClaimCheck = z.infer<typeof ClaimCheck>;

export const Draft = z.object({
  id: Id,
  actionId: Id,
  revisionNumber: z.number().int().min(1),
  text: z.string(),
  claimChecks: z.array(ClaimCheck),
  approvedAt: Timestamp.nullable(),
  exportedAt: Timestamp.nullable(),
  /** Set only when the customer confirms they published it. */
  publishedAt: Timestamp.nullable(),
});
export type Draft = z.infer<typeof Draft>;

/** Approval is blocked unless every drafted claim is supported. */
export function canApproveDraft(draft: Pick<Draft, "claimChecks">): boolean {
  return draft.claimChecks.every((c) => c.supported && (c.factId !== null || c.sourceUrl !== null));
}

// ---------------------------------------------------------------------------
// Snapshot pipeline (website reading and progress)
// ---------------------------------------------------------------------------

/** One page of the company's website, as text. Treated as data, never as instructions. */
export const ExtractedPage = z.object({
  url: HttpUrl,
  title: z.string(),
  content: z.string(),
});
export type ExtractedPage = z.infer<typeof ExtractedPage>;

export const SNAPSHOT_STEPS = ["reading", "facts", "asking", "classifying", "diagnosing", "done"] as const;
export const SnapshotStep = z.enum(SNAPSHOT_STEPS);
export type SnapshotStep = z.infer<typeof SnapshotStep>;

/** Saved after every step, so a snapshot can resume after an error or a reload. */
export const SnapshotProgress = z.object({
  auditId: Id,
  step: SnapshotStep,
  /** Index of the next answer to get (asking) or classify (classifying). */
  index: z.number().int().min(0),
  /** Total answers in this audit: 10 for a snapshot, 15 for a deep audit (5 questions x 3 runs). */
  totalQuestions: z.number().int().min(1),
  status: z.enum(["running", "failed", "done"]),
  /** Plain-language error shown with a "Try again" button. */
  error: z.string().nullable(),
  /** Failed attempts on the current step (used to retry safely). */
  attempts: z.number().int().min(0),
  updatedAt: Timestamp,
});
export type SnapshotProgress = z.infer<typeof SnapshotProgress>;
