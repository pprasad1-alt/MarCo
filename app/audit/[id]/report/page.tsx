import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, FlaskConical } from "lucide-react";
import { AnswersList } from "@/components/marco/answers-list";
import { DismissButton } from "@/components/marco/dismiss-button";
import { FindingBadge } from "@/components/marco/finding-badge";
import { MetricTile } from "@/components/marco/metric-tile";
import { OutcomeBadge } from "@/components/marco/outcome-badge";
import { StatusPill } from "@/components/marco/status-pill";
import { Button } from "@/components/ui/button";
import { STRENGTH_LABELS } from "@/lib/findings";
import { buildSnapshotResults } from "@/lib/results";
import { getSnapshotBundle } from "@/lib/store";
import { FOCUS_AREA_LABELS, type Action, type Issue } from "@/lib/types";

export const metadata: Metadata = { title: "Deep audit report · MarCo" };

function IssueCard({ issue, action, primary }: { issue: Issue; action: Action; primary: boolean }) {
  return (
    <article className="space-y-3 rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <FindingBadge kind={issue.kind} />
        <OutcomeBadge outcome={action.outcome} />
        {action.outcome === "correction" && <StatusPill status={action.status} />}
      </div>
      <h3 className="font-semibold text-slate-900">{issue.observedIssue}</h3>
      <p className="text-sm text-slate-600">
        <span className="font-medium text-slate-700">Recommended: </span>
        {action.recommendedAction}
      </p>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
        <div className="flex gap-1">
          <dt>Buyer relevance</dt>
          <dd className="font-mono text-slate-800">{issue.relevance}/3</dd>
        </div>
        <div className="flex gap-1">
          <dt>Business impact</dt>
          <dd className="font-mono text-slate-800">{issue.impact}/3</dd>
        </div>
        <div className="flex gap-1">
          <dt>Evidence</dt>
          <dd className="text-slate-800">{STRENGTH_LABELS[issue.evidenceStrength]}</dd>
        </div>
      </dl>
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
  const bundle = await getSnapshotBundle(id);
  if (!bundle?.brand) notFound();
  if (bundle.audit.type === "snapshot") redirect(`/snapshot/${id}/results`);
  if (bundle.progress?.status !== "done") redirect(`/audit/${id}`);

  const { brand, runs, audit, issues, actions } = bundle;
  const results = buildSnapshotResults(bundle);
  const area = audit.focusArea ? FOCUS_AREA_LABELS[audit.focusArea] : "";
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
      <header className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">Deep audit · {area}</p>
        <h1 className="text-3xl font-semibold tracking-tight">What to fix: {area.toLowerCase()}</h1>
        <p className="text-sm text-slate-500">
          {brand.name} · {runs.length} AI answers (5 questions, 3 runs each) · {date}
        </p>
        {isMock && (
          <p className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Sample results for {brand.name}, a fictional company. No real audit was run.
          </p>
        )}
        <p className="text-slate-600">
          Findings are checked against the facts you confirmed. {open.length} {open.length === 1 ? "issue" : "issues"} found,{" "}
          {corrections} with a recommended correction.
        </p>
      </header>

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
            {open.map(({ issue, action }) => (
              <IssueCard key={issue.id} issue={issue} action={action} primary={issue.id === primaryId} />
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

      <section className="space-y-4" aria-labelledby="scorecard">
        <div className="space-y-1">
          <h2 id="scorecard" className="text-xl font-semibold tracking-tight">
            Scorecard
          </h2>
          <p className="text-sm text-slate-500">Separate measures, each shown as a count and a rate. There is no single overall score.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.scorecard.map((m) => (
            <MetricTile key={m.id} {...m} />
          ))}
        </div>
      </section>

      <AnswersList answers={results.answers} brandName={brand.name} deep />
    </div>
  );
}
