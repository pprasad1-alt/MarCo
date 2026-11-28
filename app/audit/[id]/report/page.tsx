import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { AnswersList } from "@/components/marco/answers-list";
import { ComparisonView } from "@/components/marco/comparison-view";
import { DismissButton } from "@/components/marco/dismiss-button";
import { FindingBadge } from "@/components/marco/finding-badge";
import { JourneySteps } from "@/components/marco/journey-steps";
import { SampleNote } from "@/components/marco/sample-note";
import { Scorecard } from "@/components/marco/scorecard";
import { OutcomeBadge } from "@/components/marco/outcome-badge";
import { ReauditButton } from "@/components/marco/reaudit-button";
import { StatusPill } from "@/components/marco/status-pill";
import { Button } from "@/components/ui/button";
import { STRENGTH_LABELS } from "@/lib/findings";
import { compareAudits } from "@/lib/compare";
import { buildSnapshotResults, staleIssueIds } from "@/lib/results";
import { bundleFrom, readStore } from "@/lib/store";
import { FOCUS_AREA_LABELS, type Action, type Issue } from "@/lib/types";

export const metadata: Metadata = { title: "Deep audit report · MarCo" };

function IssueCard({
  issue,
  action,
  primary,
  stale,
  rank,
}: {
  issue: Issue;
  action: Action;
  primary: boolean;
  stale: boolean;
  rank: number;
}) {
  return (
    <article className="space-y-3 rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-slate-400" aria-label={`Priority rank ${rank}`}>
            {String(rank).padStart(2, "0")}
          </span>
          <FindingBadge kind={issue.kind} />
        </div>
        {action.outcome === "correction" && <StatusPill status={action.status} />}
      </div>
      <h3 className="font-semibold text-slate-900">{issue.observedIssue}</h3>
      {stale && (
        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          The fact behind this finding changed after this audit. Run a re-audit to check it again.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <OutcomeBadge outcome={action.outcome} />
        <span className="text-slate-500">
          Relevance <span className="font-mono text-slate-800">{issue.relevance}/3</span> · Impact{" "}
          <span className="font-mono text-slate-800">{issue.impact}/3</span> · Evidence{" "}
          <span className="text-slate-800">{STRENGTH_LABELS[issue.evidenceStrength].toLowerCase()}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button asChild variant={primary ? "default" : "outline"}>
          <Link href={`/action/${action.id}`}>
            Open action card <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <DismissButton issueId={issue.id} dismissed={issue.rejectedByUser} />
      </div>
    </article>
  );
}

export default async function DeepReportPage(props: PageProps<"/audit/[id]/report">) {
  const { id } = await props.params;
  const data = await readStore({ auditId: id });
  const bundle = bundleFrom(data, id);
  if (!bundle?.brand) notFound();
  if (bundle.audit.type === "snapshot") redirect(`/snapshot/${id}/results`);
  if (bundle.progress?.status !== "done") redirect(`/audit/${id}`);

  const { brand, runs, audit, issues, actions } = bundle;
  const results = buildSnapshotResults(bundle);
  const area = audit.focusArea ? FOCUS_AREA_LABELS[audit.focusArea] : "";
  const isReaudit = audit.type === "re_audit";
  const baseline = isReaudit && audit.baselineAuditId ? bundleFrom(data, audit.baselineAuditId) : null;
  const comparison = baseline ? compareAudits(baseline, bundle) : null;
  const baselineId = isReaudit ? audit.baselineAuditId : audit.id;
  const reaudits = data.audits
    .filter((a) => a.type === "re_audit" && a.baselineAuditId === baselineId && a.id !== audit.id)
    .filter((a) => data.progress.find((p) => p.auditId === a.id)?.status === "done");
  const snapshotId = data.audits.find((a) => a.brandId === brand.id && a.type === "snapshot")?.id;
  const stale = staleIssueIds(bundle);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" });
  const isMock = runs.some((r) => r.mode === "MOCK");
  const date = new Date(audit.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" });
  const withAction = issues.flatMap((issue) => {
    const action = actions.find((a) => a.issueId === issue.id);
    return action ? [{ issue, action }] : [];
  });
  const open = withAction.filter((x) => !x.issue.rejectedByUser);
  const dismissed = withAction.filter((x) => x.issue.rejectedByUser);
  const corrections = open.filter((x) => x.action.outcome === "correction").length;
  const primaryId = (open.find((x) => x.action.outcome === "correction") ?? open[0])?.issue.id;

  return (
    <div className="space-y-12">
      <JourneySteps current={isReaudit ? "Re-audit" : "Fix"} />
      <header className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">
          {isReaudit ? "Re-audit" : "Deep audit"} · {area}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">What to fix: {area.toLowerCase()}</h1>
        <p className="text-sm text-slate-500">
          {brand.name} · {runs.length} AI answers (5 questions, 3 runs each) · {date}
        </p>
        {isMock && (
          <SampleNote>Sample results for {brand.name}, a fictional company. No real audit was run.</SampleNote>
        )}
        <p className="text-slate-600">
          Findings are checked against the facts you confirmed. {open.length} {open.length === 1 ? "issue" : "issues"}{" "}
          found, {corrections} with a recommended correction.
        </p>
      </header>

      {comparison && baseline && (
        <ComparisonView comparison={comparison} baselineDate={fmtDate(baseline.audit.createdAt)} />
      )}

      {reaudits.length > 0 && (
        <section className="space-y-2" aria-labelledby="history">
          <h2 id="history" className="text-xl font-semibold tracking-tight">
            Audit history
          </h2>
          <ul className="space-y-1 text-sm">
            {baselineId && baselineId !== audit.id && (
              <li>
                <a href={`/audit/${baselineId}/report`} className="text-indigo-600 hover:underline">
                  Baseline deep audit
                </a>
              </li>
            )}
            {reaudits.map((a) => (
              <li key={a.id}>
                <a href={`/audit/${a.id}/report`} className="text-indigo-600 hover:underline">
                  Re-audit from{" "}
                  {new Date(a.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="issues">
        <div className="space-y-1">
          <h2 id="issues" className="text-xl font-semibold tracking-tight">
            Issues, by priority
          </h2>
          <p className="text-sm text-slate-500">
            Priority combines buyer relevance, business impact and how consistently the issue showed up across runs.
          </p>
        </div>
        {open.length > 0 ? (
          <div className="grid gap-4">
            {open.map(({ issue, action }, n) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                action={action}
                primary={issue.id === primaryId}
                stale={stale.has(issue.id)}
                rank={n + 1}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border p-6 text-slate-600">
            No open issues in this focus area. AI answers matched your confirmed facts, or you marked the issues as not
            relevant.
          </p>
        )}
        {dismissed.length > 0 && (
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Marked as not an issue ({dismissed.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {dismissed.map(({ issue }) => (
                <li key={issue.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                  <span>{issue.observedIssue}</span>
                  <DismissButton issueId={issue.id} dismissed />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section
        aria-labelledby="next-step"
        className="flex flex-col gap-4 rounded-xl border bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="space-y-1">
          <h2 id="next-step" className="font-semibold text-slate-900">
            {isReaudit ? "Check again later" : "After you publish a correction"}
          </h2>
          <p className="text-sm text-slate-600">
            A re-audit asks the same 5 questions again and compares the answers with this baseline.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ReauditButton auditId={audit.id} label={isReaudit ? "Run another re-audit" : "Run a re-audit"} />
          {snapshotId && (
            <a
              href={`/snapshot/${snapshotId}/facts?return=${audit.id}`}
              className="text-sm text-indigo-600 hover:underline"
            >
              Review your facts
            </a>
          )}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="scorecard">
        <div className="space-y-1">
          <h2 id="scorecard" className="text-xl font-semibold tracking-tight">
            Scorecard
          </h2>
          <p className="text-sm text-slate-500">
            Separate measures, each shown as a count and a rate. There is no single overall score.
          </p>
        </div>
        <Scorecard metrics={results.scorecard} />
      </section>

      <AnswersList answers={results.answers} brandName={brand.name} deep />
    </div>
  );
}
