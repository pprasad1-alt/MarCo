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
  /** Small secondary line under the explanation, e.g. "Any source listed: 4 of 5". */
  secondary?: string;
};

/** How often each competitor (and the brand itself) was named in discovery answers. */
export type CompetitorMention = { name: string; count: number; total: number; isBrand: boolean };

export type ScorecardInput = {
  runs: AuditRun[];
  promptFor: (run: AuditRun) => Prompt;
  claims: Claim[];
  gaps: Gap[];
  competitors: string[];
  brandName?: string;
  /** Hostnames that count as the company's own website (e.g. its domain and the pages facts came from). */
  ownHosts?: string[];
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Does this answer cite the company's own website? (Subdomains count.) */
export function citesOwnSite(run: AuditRun, ownHosts: string[]): boolean {
  const own = ownHosts.map((h) => h.toLowerCase().replace(/^www\./, ""));
  return run.rawCitations.some((c) => {
    const h = hostOf(c.url);
    return Boolean(h) && own.some((o) => h === o || h!.endsWith(`.${o}`));
  });
}

/** Each competitor, plus the brand itself, with how many discovery answers named it. */
export function competitorMentions({ runs, promptFor, gaps, competitors, brandName }: ScorecardInput): CompetitorMention[] {
  const discovery = runs.filter((r) => r.status === "completed" && r.answer && promptFor(r).type === "discovery");
  const rows = competitors.map((name) => ({
    name,
    count: discovery.filter((r) => mentionsBrand(r.answer ?? "", name)).length,
    total: discovery.length,
    isBrand: false,
  }));
  if (brandName) {
    rows.push({
      name: brandName,
      // Same rule as the unaided mention rate: no visibility gap = the brand was included.
      count: discovery.filter((r) => !gaps.some((g) => g.auditRunId === r.id && g.type === "visibility")).length,
      total: discovery.length,
      isBrand: true,
    });
  }
  return rows;
}

export function computeScorecard({ runs, promptFor, claims, gaps, ownHosts = [] }: ScorecardInput): Metric[] {
  const completed = runs.filter((r) => r.status === "completed" && r.answer);
  const discovery = completed.filter((r) => promptFor(r).type === "discovery");
  const factQs = completed.filter((r) => promptFor(r).type === "fact_verification");
  const gapsFor = (r: AuditRun, type: Gap["type"]) => gaps.some((g) => g.auditRunId === r.id && g.type === type);

  const mentioned = discovery.filter((r) => !gapsFor(r, "visibility")).length;

  // Only claims checked against CONFIRMED facts count toward verified accuracy.
  const verifiable = claims.filter((c) => !c.potential && c.label !== "unverifiable");
  const verifiedAccurate = verifiable.filter((c) => c.label === "accurate").length;

  const unsupported = claims.filter((c) => c.label === "unverifiable").length;
  const withCoverageGap = factQs.filter((r) => gapsFor(r, "coverage")).length;
  const anySource = (rs: AuditRun[]) => rs.filter((r) => r.rawCitations.length > 0).length;
  const ownSite = (rs: AuditRun[]) => rs.filter((r) => citesOwnSite(r, ownHosts)).length;

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
      label: "Cited your website: discovery questions",
      count: ownSite(discovery),
      total: discovery.length,
      explanation: "Discovery answers that cited a page on your website.",
      howCalculated:
        "Discovery and comparison answers that listed at least one page from your own website as a source, divided by all of them. No citations means evidence is unavailable, not that the answer is wrong.",
      secondary: `Any source listed: ${anySource(discovery)} of ${discovery.length}`,
    },
    {
      id: "citations-fact",
      label: "Cited your website: fact questions",
      count: ownSite(factQs),
      total: factQs.length,
      explanation: "Answers about you that cited a page on your website.",
      howCalculated:
        "Fact-verification answers that listed at least one page from your own website as a source, divided by all of them. No citations means evidence is unavailable, not that the answer is wrong.",
      secondary: `Any source listed: ${anySource(factQs)} of ${factQs.length}`,
    },
  ];
}
