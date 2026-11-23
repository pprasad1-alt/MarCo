/**
 * Re-audit comparison: baseline deep audit vs a later re-audit of the same questions.
 *
 * Wording rules (build plan): changes are directional, never proof. A sample of
 * 3 runs per question can change by chance. "No observed change" is reported
 * honestly. If the model, settings or questions differ, the comparison carries
 * a comparability warning.
 */
import { buildSnapshotResults } from "@/lib/results";
import type { SnapshotBundle } from "@/lib/store";
import type { FindingKind } from "@/lib/types";

export type MetricChange = {
  id: string;
  label: string;
  before: { count: number; total: number };
  after: { count: number; total: number };
  /** up / down / same, by rate. not_comparable if either side had nothing to measure. */
  direction: "up" | "down" | "same" | "not_comparable";
  /** Is "up" good for this metric? null when neither direction is better (e.g. competitor inclusion). */
  higherIsBetter: boolean | null;
};

export type IssueChange = {
  key: string;
  kind: Exclude<FindingKind, "accurate">;
  observedIssue: string;
  /** Number of answers the issue appeared in. */
  before: number;
  after: number;
  change: "not_seen" | "fewer" | "same" | "more" | "new";
};

export type Comparison = {
  warnings: string[];
  metrics: MetricChange[];
  issues: IssueChange[];
  published: { observedIssue: string; publishedAt: string }[];
};

const HIGHER_IS_BETTER: Record<string, boolean | null> = {
  "unaided-mention": true,
  "competitor-inclusion": null,
  "verified-accuracy": true,
  "unsupported-claims": false,
  "coverage-gaps": false,
  "citations-discovery": true,
  "citations-fact": true,
};

function distinct(values: string[]): string[] {
  return [...new Set(values)].sort();
}

/** Reasons the two audits may not be directly comparable. */
export function comparabilityWarnings(baseline: SnapshotBundle, current: SnapshotBundle): string[] {
  const warnings: string[] = [];
  const pair = (fn: (b: SnapshotBundle) => string[]) => [distinct(fn(baseline)), distinct(fn(current))] as const;
  const differs = ([a, b]: readonly [string[], string[]]) => a.join("|") !== b.join("|");

  const models = pair((b) => b.runs.map((r) => r.modelId));
  if (differs(models)) warnings.push(`The AI model changed (${models[0].join(", ")} → ${models[1].join(", ")}).`);
  const modes = pair((b) => b.runs.map((r) => r.mode));
  if (differs(modes)) warnings.push(`The audit mode changed (${modes[0].join(", ")} → ${modes[1].join(", ")}).`);
  if (differs(pair((b) => b.runs.map((r) => JSON.stringify(r.groundingSettings))))) warnings.push("Search grounding settings changed.");
  if (differs(pair((b) => b.runs.map((r) => JSON.stringify(r.generationSettings))))) warnings.push("Generation settings changed.");
  if (differs(pair((b) => b.runs.map((r) => `${r.promptId}@${r.promptVersion}`)))) warnings.push("The questions or their versions changed.");

  // Facts edited, rejected or unconfirmed after the baseline was classified.
  const factNow = new Map(current.facts.map((f) => [f.id, f]));
  const changed = baseline.claims.some((c) => {
    if (!c.matchedFactId) return false;
    const f = factNow.get(c.matchedFactId);
    return !f || f.rejected || !f.confirmed || f.version !== c.matchedFactVersion;
  });
  if (changed) warnings.push("Some of your confirmed facts changed after the baseline audit, so a few labels may differ for that reason.");
  return warnings;
}

function issueCounts(bundle: SnapshotBundle) {
  const map = new Map<string, { kind: IssueChange["kind"]; observedIssue: string; count: number }>();
  for (const i of bundle.issues) {
    if (i.kind === "accurate") continue;
    const key = `${i.kind}|${i.observedIssue}`;
    map.set(key, { kind: i.kind, observedIssue: i.observedIssue, count: i.claimIds.length + i.gapIds.length });
  }
  return map;
}

export function compareAudits(baseline: SnapshotBundle, current: SnapshotBundle): Comparison {
  const before = buildSnapshotResults(baseline).scorecard;
  const after = buildSnapshotResults(current).scorecard;

  const metrics: MetricChange[] = before.flatMap((b) => {
    const a = after.find((m) => m.id === b.id);
    if (!a) return [];
    let direction: MetricChange["direction"] = "not_comparable";
    if (b.total > 0 && a.total > 0) {
      const diff = a.count / a.total - b.count / b.total;
      direction = Math.abs(diff) < 1e-9 ? "same" : diff > 0 ? "up" : "down";
    }
    return [
      {
        id: b.id,
        label: b.label,
        before: { count: b.count, total: b.total },
        after: { count: a.count, total: a.total },
        direction,
        higherIsBetter: HIGHER_IS_BETTER[b.id] ?? null,
      },
    ];
  });

  const was = issueCounts(baseline);
  const now = issueCounts(current);
  const order: Record<IssueChange["change"], number> = { fewer: 0, not_seen: 1, more: 2, new: 3, same: 4 };
  const issues: IssueChange[] = [...new Set([...was.keys(), ...now.keys()])]
    .map((key) => {
      const b = was.get(key);
      const a = now.get(key);
      const beforeN = b?.count ?? 0;
      const afterN = a?.count ?? 0;
      const change: IssueChange["change"] = !b ? "new" : afterN === 0 ? "not_seen" : afterN < beforeN ? "fewer" : afterN > beforeN ? "more" : "same";
      return { key, kind: (b ?? a)!.kind, observedIssue: (b ?? a)!.observedIssue, before: beforeN, after: afterN, change };
    })
    .sort((x, y) => order[x.change] - order[y.change]);

  const published = baseline.actions
    .filter((a) => a.status === "Published")
    .flatMap((a) => {
      const issue = baseline.issues.find((i) => i.id === a.issueId);
      const draft = baseline.drafts.filter((d) => d.actionId === a.id && d.publishedAt).at(-1);
      return issue && draft?.publishedAt ? [{ observedIssue: issue.observedIssue, publishedAt: draft.publishedAt }] : [];
    });

  return { warnings: comparabilityWarnings(baseline, current), metrics, issues, published };
}

export const ISSUE_CHANGE_LABELS: Record<IssueChange["change"], string> = {
  not_seen: "Not seen in this re-audit",
  fewer: "Seen less often",
  same: "No observed change",
  more: "Seen more often",
  new: "New in this re-audit",
};
