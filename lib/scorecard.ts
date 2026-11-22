/**
 * Scorecard (CLAUDE.md "Scorecard"): separate metrics, counts shown with rates,
 * and NO combined score.
 */
import { mentionsBrand } from "@/lib/prompts";
import type { AuditRun, Claim, Gap, Prompt } from "@/lib/types";

export type Metric = {
  id: string;
  label: string;
  count: number;
  /** 0 = nothing to measure (shown as N/A). */
  total: number;
  explanation: string;
  howCalculated: string;
  notApplicableReason?: string;
};

export type ScorecardInput = {
  runs: AuditRun[];
  promptFor: (run: AuditRun) => Prompt;
  claims: Claim[];
  gaps: Gap[];
  competitors: string[];
};

export function computeScorecard({ runs, promptFor, claims, gaps, competitors }: ScorecardInput): Metric[] {
  const completed = runs.filter((r) => r.status === "completed" && r.answer);
  const discovery = completed.filter((r) => promptFor(r).type === "discovery");
  const factQs = completed.filter((r) => promptFor(r).type === "fact_verification");
  const gapsFor = (r: AuditRun, type: Gap["type"]) => gaps.some((g) => g.auditRunId === r.id && g.type === type);

  const mentioned = discovery.filter((r) => !gapsFor(r, "visibility")).length;
  const withCompetitor = discovery.filter((r) => competitors.some((c) => mentionsBrand(r.answer ?? "", c))).length;

  // Only claims checked against CONFIRMED facts count toward verified accuracy.
  const verifiable = claims.filter((c) => !c.potential && c.label !== "unverifiable");
  const verifiedAccurate = verifiable.filter((c) => c.label === "accurate").length;

  const unsupported = claims.filter((c) => c.label === "unverifiable").length;
  const withCoverageGap = factQs.filter((r) => gapsFor(r, "coverage")).length;
  const cited = (rs: AuditRun[]) => rs.filter((r) => r.rawCitations.length > 0).length;

  return [
    {
      id: "unaided-mention",
      label: "Unaided brand mention rate",
      count: mentioned,
      total: discovery.length,
      explanation: "Buyer questions where the AI mentioned you without being asked about you.",
      howCalculated:
        "Discovery and comparison answers that name your company, divided by all discovery and comparison answers. These questions never mention your company.",
    },
    {
      id: "competitor-inclusion",
      label: "Competitor inclusion",
      count: withCompetitor,
      total: discovery.length,
      explanation: "Buyer questions where the AI named at least one of your competitors.",
      howCalculated:
        "Discovery and comparison answers that name at least one competitor you listed, divided by all discovery and comparison answers.",
    },
    {
      id: "verified-accuracy",
      label: "Verified claim accuracy",
      count: verifiedAccurate,
      total: verifiable.length,
      explanation: "Claims about you that match your confirmed facts.",
      howCalculated: "Accurate claims divided by all claims checked against facts you have confirmed.",
      notApplicableReason: "N/A until you confirm your facts. Snapshot findings are potential, not verified.",
    },
    {
      id: "unsupported-claims",
      label: "Unsupported claims",
      count: unsupported,
      total: claims.length,
      explanation: "Claims about you that we couldn't check against your website.",
      howCalculated: "Claims with no matching fact on your website, divided by all claims the AI made about you.",
      notApplicableReason: "The AI made no claims about you.",
    },
    {
      id: "coverage-gaps",
      label: "Answers with coverage gaps",
      count: withCoverageGap,
      total: factQs.length,
      explanation: "Answers about you that left out a relevant fact. A missing detail, not an error.",
      howCalculated:
        "Fact questions whose answer missed at least one fact relevant to that question, divided by all fact questions.",
    },
    {
      id: "citations-discovery",
      label: "Citation rate: discovery questions",
      count: cited(discovery),
      total: discovery.length,
      explanation: "Discovery answers that listed any source.",
      howCalculated:
        "Discovery and comparison answers that returned at least one citation, divided by all of them. No citations means evidence is unavailable, not that the answer is wrong.",
    },
    {
      id: "citations-fact",
      label: "Citation rate: fact questions",
      count: cited(factQs),
      total: factQs.length,
      explanation: "Answers about you that listed any source.",
      howCalculated:
        "Fact-verification answers that returned at least one citation, divided by all of them. No citations means evidence is unavailable, not that the answer is wrong.",
    },
  ];
}
