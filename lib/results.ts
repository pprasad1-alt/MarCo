/**
 * Turns a finished snapshot into what the results screen shows:
 * scorecard, ranked findings, and every answer with its findings.
 */
import { findingKindForClaim, findingKindForGap } from "@/lib/findings";
import { getPrompt, mentionsBrand } from "@/lib/prompts";
import { computeScorecard, type Metric } from "@/lib/scorecard";
import type { SnapshotBundle } from "@/lib/store";
import type { AuditRun, Fact, FindingKind, FocusArea, Prompt, RawCitation } from "@/lib/types";

export type Finding = {
  id: string;
  kind: FindingKind;
  potential: boolean;
  title: string;
  /** The AI's exact words. */
  quote: string;
  question: string;
  focusArea: FocusArea;
  citations: RawCitation[];
  whyItMatters: string;
  /** What the website says, when the finding relates to a fact. */
  fact: Pick<Fact, "value" | "sourceUrl"> | null;
};

export type AnswerView = { run: AuditRun; prompt: Prompt; findings: Finding[] };

export type SnapshotResults = {
  scorecard: Metric[];
  topFindings: Finding[];
  answers: AnswerView[];
  counts: Record<FindingKind, number>;
};

const KIND_WEIGHT: Record<FindingKind, number> = {
  inaccurate: 5,
  visibility_gap: 4,
  coverage_gap: 3,
  unverifiable: 2,
  accurate: 0,
};

const FOCUS_WEIGHT: Record<FocusArea, number> = {
  pricing_plans: 3,
  comparisons_alternatives: 3,
  product_features: 2,
  use_cases_customers: 2,
  integrations: 2,
  company_credibility: 1,
};

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function whyItMatters(kind: FindingKind, focusArea: FocusArea, ctx: { competitorsNamed: string[]; fact?: Fact }): string {
  switch (kind) {
    case "inaccurate":
      if (focusArea === "pricing_plans") return "Buyers comparing prices may get the wrong idea about your plans.";
      if (focusArea === "use_cases_customers") return "Buyers may decide you aren't built for companies like theirs.";
      if (focusArea === "company_credibility") return "Wrong company details can make buyers trust you less.";
      return "Buyers may make decisions based on wrong information about you.";
    case "visibility_gap":
      return ctx.competitorsNamed.length
        ? `Buyers asking this don't hear about you, while ${ctx.competitorsNamed.join(", ")} ${ctx.competitorsNamed.length > 1 ? "are" : "is"} named.`
        : "Buyers asking this don't hear about you.";
    case "coverage_gap":
      return ctx.fact
        ? `Buyers asking this don't learn something your website says: ${lowerFirst(ctx.fact.value)}.`
        : "The answer leaves out something buyers would want to know.";
    case "unverifiable":
      return "AI tells buyers something we couldn't check against your website. If it's wrong, it sets false expectations.";
    case "accurate":
      return "AI describes this correctly.";
  }
}

export function buildSnapshotResults(bundle: SnapshotBundle): SnapshotResults {
  const { runs, claims, gaps, facts, brand } = bundle;
  const competitors = brand?.competitors ?? [];
  const factById = new Map(facts.map((f) => [f.id, f]));
  const promptFor = (r: AuditRun) => getPrompt(r.promptId);

  const answers: AnswerView[] = runs.map((run) => {
    const prompt = promptFor(run);
    const answer = run.answer ?? "";
    const competitorsNamed = competitors.filter((c) => mentionsBrand(answer, c));
    const base = { question: run.promptText, focusArea: prompt.focusArea, citations: run.rawCitations };

    const fromClaims: Finding[] = claims
      .filter((c) => c.auditRunId === run.id)
      .map((c) => {
        const kind = findingKindForClaim(c.label);
        const fact = c.matchedFactId ? factById.get(c.matchedFactId) : undefined;
        return {
          ...base,
          id: c.id,
          kind,
          potential: c.potential,
          title:
            kind === "inaccurate"
              ? "May conflict with your website"
              : kind === "accurate"
                ? "Matches your website"
                : "Claim we couldn't check",
          quote: c.answerExcerpt,
          whyItMatters: whyItMatters(kind, prompt.focusArea, { competitorsNamed, fact }),
          fact: fact ? { value: fact.value, sourceUrl: fact.sourceUrl } : null,
        };
      });

    const fromGaps: Finding[] = gaps
      .filter((g) => g.auditRunId === run.id)
      .map((g) => {
        const kind = findingKindForGap(g.type);
        const fact = g.expectedFactId ? factById.get(g.expectedFactId) : undefined;
        return {
          ...base,
          id: g.id,
          kind,
          potential: g.potential,
          title: kind === "visibility_gap" ? "You weren't included in this answer" : "A relevant fact was left out",
          quote: kind === "visibility_gap" ? answer : firstSentence(answer),
          whyItMatters: whyItMatters(kind, prompt.focusArea, { competitorsNamed, fact }),
          fact: fact ? { value: fact.value, sourceUrl: fact.sourceUrl } : null,
        };
      });

    return { run, prompt, findings: [...fromClaims, ...fromGaps] };
  });

  const all = answers.flatMap((a) => a.findings);
  const score = (f: Finding) => KIND_WEIGHT[f.kind] * 10 + FOCUS_WEIGHT[f.focusArea];
  const ranked = all.filter((f) => f.kind !== "accurate").sort((a, b) => score(b) - score(a));

  // Top 3: the strongest finding of each kind first (variety), then by score.
  const top: Finding[] = [];
  for (const f of ranked) if (top.length < 3 && !top.some((t) => t.kind === f.kind)) top.push(f);
  for (const f of ranked) if (top.length < 3 && !top.includes(f)) top.push(f);
  top.sort((a, b) => score(b) - score(a));

  const counts = { accurate: 0, inaccurate: 0, unverifiable: 0, visibility_gap: 0, coverage_gap: 0 } as Record<FindingKind, number>;
  for (const f of all) counts[f.kind] += 1;

  return {
    scorecard: computeScorecard({ runs, promptFor, claims, gaps, competitors }),
    topFindings: top,
    answers,
    counts,
  };
}
