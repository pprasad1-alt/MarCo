/**
 * Diagnosis: classified findings -> ranked issues -> corrective actions (+ drafts).
 *
 * All decisions here are rules in code (tested), following CLAUDE.md:
 *  - Omissions are gaps, never errors.
 *  - If the website already states the fact clearly, recommend investigation,
 *    not new content.
 *  - "No correction recommended" and "Further investigation needed" are valid outcomes.
 *  - Drafts only use CONFIRMED facts, and every sentence is claim-checked.
 *
 * The only AI-dependent part is the content check (does the site state the fact
 * clearly?). In mock mode it comes from the fixture; live mode will ask Gemini.
 */
import { checkDraftClaims, factSentence } from "@/lib/drafts";
import { NotConnectedError } from "@/lib/extract";
import { type ModeInfo } from "@/lib/mode";
import { MOCK_FIXTURE } from "@/lib/mock";
import { getPrompt } from "@/lib/prompts";
import type {
  Action,
  ActionOutcome,
  AuditRun,
  Brand,
  Claim,
  ContentCheckResult,
  Draft,
  EvidenceStrength,
  ExtractedPage,
  Fact,
  FactType,
  FindingKind,
  FocusArea,
  Gap,
  Issue,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Content check
// ---------------------------------------------------------------------------

export type ContentCheck = { result: ContentCheckResult; note: string };

/** Does the website already state this fact clearly? */
export async function checkWebsiteContent(
  fact: Fact,
  brand: Pick<Brand, "id">,
  pages: ExtractedPage[],
  mode: ModeInfo,
): Promise<ContentCheck> {
  if (mode.mode !== "MOCK") throw new NotConnectedError("Website content check (Gemini)");
  const key = fact.id.startsWith(`${brand.id}-`) ? fact.id.slice(brand.id.length + 1) : fact.id;
  const fixture = MOCK_FIXTURE.contentChecks[key];
  if (fixture && fact.version === 1) return fixture;
  // Edited or unknown facts: is the exact wording on its source page?
  const page = pages.find((p) => p.url === fact.sourceUrl);
  if (page && page.content.toLowerCase().includes(fact.value.toLowerCase())) {
    return { result: "stated_clearly", note: `Your page “${page.title}” states this.` };
  }
  return page
    ? { result: "stated_unclearly", note: `Your page “${page.title}” doesn't state this in these words.` }
    : { result: "not_stated", note: "We couldn't find this on the pages we read." };
}

// ---------------------------------------------------------------------------
// Grouping and priority
// ---------------------------------------------------------------------------

type Occurrence = { run: AuditRun; claim?: Claim; gap?: Gap };

type Group = {
  key: string;
  kind: Exclude<FindingKind, "accurate">;
  fact?: Fact;
  promptId: string;
  occurrences: Occurrence[];
};

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

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
export function buyerRelevance(kind: Group["kind"], focusArea: FocusArea): 1 | 2 | 3 {
  if (kind === "visibility_gap") return 3;
  return FOCUS_RELEVANCE[focusArea];
}

/** Business impact 1-3: a wrong fact hurts most; an unverifiable claim least. */
export function businessImpact(kind: Group["kind"], focusArea: FocusArea): 1 | 2 | 3 {
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

// ---------------------------------------------------------------------------
// Destinations and drafts
// ---------------------------------------------------------------------------

const DESTINATION_FOR_FACT: Record<FactType, string> = {
  pricing: "Pricing page",
  use_case: "Homepage, in a clear “who it's for” line near the top",
  customer: "Homepage",
  integration: "Integrations page",
  product_feature: "Features page",
  company: "About page",
  competitor_positioning: "Comparison page",
  other: "The page that covers this topic",
};

const FACT_TYPES_FOR_FOCUS: Record<FocusArea, FactType[]> = {
  pricing_plans: ["pricing"],
  use_cases_customers: ["use_case", "customer"],
  product_features: ["product_feature"],
  integrations: ["integration"],
  comparisons_alternatives: ["use_case", "product_feature", "pricing"],
  company_credibility: ["company", "customer"],
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Third-party sites the AI cited in these answers (not the brand's own site). */
function thirdPartySources(occurrences: Occurrence[], brand: Brand, facts: Fact[]): string[] {
  const own = new Set([brand.url, ...facts.map((f) => f.sourceUrl)].map(hostOf).filter(Boolean));
  const hosts = occurrences.flatMap((o) => o.run.rawCitations.map((c) => hostOf(c.url)));
  return [...new Set(hosts.filter((h): h is string => Boolean(h) && !own.has(h)))];
}

function buildDraftText(brand: Brand, facts: Fact[]): string {
  return facts.map((f) => factSentence(brand.name, f)).join(" ");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export type DiagnosisInput = {
  auditId: string;
  brand: Brand;
  facts: Fact[];
  runs: AuditRun[];
  claims: Claim[];
  gaps: Gap[];
  pages: ExtractedPage[];
  mode: ModeInfo;
};

export type Diagnosis = { issues: Issue[]; actions: Action[]; drafts: Draft[] };

export async function diagnose({ auditId, brand, facts: allFacts, runs, claims, gaps, pages, mode }: DiagnosisInput): Promise<Diagnosis> {
  const facts = allFacts.filter((f) => !f.rejected);
  const factById = new Map(facts.map((f) => [f.id, f]));
  const runById = new Map(runs.map((r) => [r.id, r]));
  const groups = new Map<string, Group>();

  const add = (key: string, g: Omit<Group, "key" | "occurrences">, occ: Occurrence) => {
    const existing = groups.get(key) ?? { ...g, key, occurrences: [] };
    if (!existing.occurrences.some((o) => o.run.id === occ.run.id)) existing.occurrences.push(occ);
    groups.set(key, existing);
  };

  for (const claim of claims) {
    const run = runById.get(claim.auditRunId);
    if (!run || claim.label === "accurate") continue;
    if (claim.label === "inaccurate" && claim.matchedFactId) {
      add(`inaccurate:${claim.matchedFactId}`, { kind: "inaccurate", fact: factById.get(claim.matchedFactId), promptId: run.promptId }, { run, claim });
    } else {
      add(`unverifiable:${run.promptId}:${normalizeText(claim.answerExcerpt)}`, { kind: "unverifiable", promptId: run.promptId }, { run, claim });
    }
  }
  for (const gap of gaps) {
    const run = runById.get(gap.auditRunId);
    if (!run) continue;
    if (gap.type === "visibility") {
      add(`visibility:${run.promptId}`, { kind: "visibility_gap", promptId: run.promptId }, { run, gap });
    } else if (gap.expectedFactId) {
      add(`coverage:${gap.expectedFactId}`, { kind: "coverage_gap", fact: factById.get(gap.expectedFactId), promptId: run.promptId }, { run, gap });
    }
  }

  const issues: Issue[] = [];
  const actions: Action[] = [];
  const drafts: Draft[] = [];

  const ordered = [...groups.values()].map((g) => {
    const prompt = getPrompt(g.promptId);
    const relevance = buyerRelevance(g.kind, prompt.focusArea);
    const impact = businessImpact(g.kind, prompt.focusArea);
    const strength = evidenceStrength(g.occurrences.length);
    return { g, prompt, relevance, impact, strength, score: priorityScore({ relevance, impact, evidenceStrength: strength }) };
  });
  ordered.sort((a, b) => b.score - a.score);

  for (const [n, { g, prompt, relevance, impact, strength }] of ordered.entries()) {
    const first = g.occurrences[0];
    const issueId = `${auditId}-i${n + 1}`;
    const count = g.occurrences.length;
    // Gaps and unverifiable claims are per question; wrong or missing facts can span questions.
    const perQuestion = g.kind === "visibility_gap" || g.kind === "unverifiable";
    const pool = perQuestion ? runs.filter((r) => r.promptId === g.promptId).length : runs.length;
    const times = perQuestion ? `${count} of ${pool} runs of this question` : `${count} of ${pool} answers`;
    const excerpt = first.claim?.answerExcerpt ?? (first.run.answer ?? "").split(/(?<=[.!?])\s+/)[0];

    const observedIssue =
      g.kind === "inaccurate"
        ? `AI answers contradict your fact “${g.fact?.value ?? "unknown"}”`
        : g.kind === "coverage_gap"
          ? `AI answers leave out “${g.fact?.value ?? "a relevant fact"}”`
          : g.kind === "visibility_gap"
            ? `You aren't included when buyers ask “${first.run.promptText}”`
            : `AI makes a claim we can't check: “${excerpt}”`;

    issues.push({
      id: issueId,
      auditId,
      kind: g.kind,
      observedIssue,
      claimIds: g.occurrences.flatMap((o) => (o.claim ? [o.claim.id] : [])),
      gapIds: g.occurrences.flatMap((o) => (o.gap ? [o.gap.id] : [])),
      evidenceExcerpt: excerpt,
      relevance,
      impact,
      evidenceStrength: strength,
      rejectedByUser: false,
    });

    // ----- Decide the action -----
    let outcome: ActionOutcome;
    let destination: string;
    let recommendedAction: string;
    let reason: string;
    let contentCheck: ContentCheck = { result: "not_applicable", note: "This issue isn't about one of your facts." };
    let draftFacts: Fact[] = [];

    if ((g.kind === "inaccurate" || g.kind === "coverage_gap") && g.fact) {
      const fact = g.fact;
      destination = DESTINATION_FOR_FACT[fact.factType];
      if (!fact.confirmed) {
        outcome = "investigate";
        recommendedAction = "Confirm this fact first, then run the audit again.";
        reason = "MarCo only recommends changes based on facts you have confirmed.";
      } else {
        contentCheck = await checkWebsiteContent(fact, brand, pages, mode);
        const sources = thirdPartySources(g.occurrences, brand, facts);
        if (strength === "low") {
          outcome = "investigate";
          recommendedAction = "Re-check this in your next audit before changing anything.";
          reason = `It showed up in only ${times}, which isn't enough evidence to act on yet.`;
        } else if (contentCheck.result === "stated_clearly") {
          outcome = "investigate";
          destination = sources.length ? `Third-party sources the AI cited: ${sources.join(", ")}` : "Third-party listings and review sites";
          recommendedAction =
            g.kind === "inaccurate"
              ? `Find where the wrong information comes from${sources.length ? `, starting with ${sources.join(", ")}` : ""}, and ask them to correct it. Your own page doesn't need new content.`
              : "Check that the page is public and easy for search engines to read, and that your third-party profiles say the same thing.";
          reason = `Your website already states this clearly (${contentCheck.note.replace(/\.$/, "")}), so new content is unlikely to change AI answers. ${
            g.kind === "inaccurate" ? "The AI is probably repeating an outdated or third-party source." : "The AI may not be picking that page up."
          }`;
        } else {
          outcome = "correction";
          draftFacts = [fact];
          recommendedAction = `State it plainly on your ${destination.charAt(0).toLowerCase() + destination.slice(1)}: “${factSentence(brand.name, fact)}”`;
          reason = `${g.kind === "inaccurate" ? "AI answers contradicted this" : "AI answers left this out"} in ${times}. On your website: ${contentCheck.note.charAt(0).toLowerCase() + contentCheck.note.slice(1)} A clear, specific statement gives AI assistants something accurate to repeat.`;
        }
      }
    } else if (g.kind === "visibility_gap") {
      destination = "A page that answers this buyer question directly (for example a comparison or “best tools for…” page)";
      const relevant = facts.filter((f) => f.confirmed && FACT_TYPES_FOR_FOCUS[prompt.focusArea].includes(f.factType));
      if (strength === "low") {
        outcome = "investigate";
        recommendedAction = "Re-check this in your next audit before creating new content.";
        reason = `You were left out in only ${times}.`;
      } else if (relevant.length === 0) {
        outcome = "investigate";
        recommendedAction = "Confirm the facts that answer this question, then run the audit again.";
        reason = "There are no confirmed facts to build a correction from yet.";
      } else {
        outcome = "correction";
        draftFacts = relevant;
        recommendedAction = `Publish clear, factual content that answers “${first.run.promptText}”, using your confirmed facts. Listings on review and comparison sites also shape these answers.`;
        reason = `You were left out of ${times}. AI assistants can only include you if they find clear, specific information about you.`;
      }
    } else {
      // Unverifiable claim
      destination = "Your team (check internally)";
      if (impact === 1 && strength === "low") {
        outcome = "no_correction";
        recommendedAction = "No correction recommended. Keep an eye on it in your next audit.";
        reason = `It appeared in only ${times} and is unlikely to change a buyer's decision.`;
      } else {
        outcome = "investigate";
        recommendedAction =
          "Check whether this is true. If it is, add it to your website and confirm it as a fact. If it isn't, look for where it comes from.";
        reason = `The AI said this in ${times}, but it doesn't match anything on your website, so MarCo can't tell whether it's right.`;
      }
    }

    const actionId = `${issueId}-a`;
    actions.push({
      id: actionId,
      issueId,
      contentCheckResult: contentCheck.result,
      contentCheckNote: contentCheck.note,
      destination,
      outcome,
      recommendedAction,
      reason,
      status: "Draft",
    });

    if (outcome === "correction") {
      const text = buildDraftText(brand, draftFacts);
      drafts.push({
        id: `${actionId}-d1`,
        actionId,
        revisionNumber: 1,
        text,
        claimChecks: checkDraftClaims(text, facts),
        approvedAt: null,
        exportedAt: null,
        publishedAt: null,
      });
    }
  }

  return { issues, actions, drafts };
}
