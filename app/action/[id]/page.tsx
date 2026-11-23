import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { DraftEditor } from "@/components/marco/draft-editor";
import { EvidenceQuote } from "@/components/marco/evidence-quote";
import { FindingBadge } from "@/components/marco/finding-badge";
import { OutcomeBadge } from "@/components/marco/outcome-badge";
import { CONTENT_CHECK_LABELS, OUTCOME_LABELS, STRENGTH_LABELS } from "@/lib/findings";
import { getActionBundle } from "@/lib/store";
import { FOCUS_AREA_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Corrective action · MarCo" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t pt-5">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{label}</h2>
      <div className="text-slate-800">{children}</div>
    </section>
  );
}

function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export default async function ActionPage(props: PageProps<"/action/[id]">) {
  const { id } = await props.params;
  const data = await getActionBundle(id);
  if (!data?.bundle.brand) notFound();
  const { action, issue, bundle, latestDraft } = data;
  const brand = bundle.brand!;

  // Evidence: the AI's exact words from each run where the issue showed up.
  const evidence = [
    ...bundle.claims.filter((c) => issue.claimIds.includes(c.id)).map((c) => ({ runId: c.auditRunId, quote: c.answerExcerpt })),
    ...bundle.gaps
      .filter((g) => issue.gapIds.includes(g.id))
      .map((g) => {
        const run = bundle.runs.find((r) => r.id === g.auditRunId);
        return { runId: g.auditRunId, quote: run?.answer ?? "" };
      }),
  ].flatMap((e) => {
    const run = bundle.runs.find((r) => r.id === e.runId);
    return run ? [{ ...e, run }] : [];
  });
  const shown = evidence.slice(0, 3);
  const factId =
    bundle.claims.find((c) => issue.claimIds.includes(c.id))?.matchedFactId ??
    bundle.gaps.find((g) => issue.gapIds.includes(g.id))?.expectedFactId;
  const fact = factId ? bundle.facts.find((f) => f.id === factId) : undefined;
  const factHref = fact ? safeHref(fact.sourceUrl) : null;
  const isMock = bundle.runs.some((r) => r.mode === "MOCK");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/audit/${bundle.audit.id}/report`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to the report
      </Link>

      <header className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">
          Corrective action · {bundle.audit.focusArea ? FOCUS_AREA_LABELS[bundle.audit.focusArea] : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <FindingBadge kind={issue.kind} />
          <OutcomeBadge outcome={action.outcome} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{issue.observedIssue}</h1>
        {isMock && (
          <p className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Sample data for {brand.name}, a fictional company.
          </p>
        )}
      </header>

      <div className="space-y-5 rounded-xl border p-5 sm:p-6">
        <Field label="Evidence">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Seen in {evidence.length} {evidence.length === 1 ? "answer" : "answers"}
              {evidence.length > shown.length ? `; showing ${shown.length}` : ""}.
            </p>
            {shown.map((e) => (
              <EvidenceQuote
                key={`${e.run.id}-${e.quote.slice(0, 20)}`}
                quote={e.quote}
                attribution={`Run ${e.run.runNumber} · AI answer to: “${e.run.promptText}”`}
                sources={e.run.rawCitations}
              />
            ))}
            {fact && (
              <p className="rounded-lg border border-dashed p-3 text-sm text-slate-700">
                <span className="font-medium">Your confirmed fact: </span>
                {fact.value}.{" "}
                {factHref && (
                  <a href={factHref} target="_blank" rel="noopener noreferrer nofollow" className="text-indigo-600 hover:underline">
                    Source
                  </a>
                )}
              </p>
            )}
          </div>
        </Field>

        <Field label="Priority">
          <dl className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-sm text-slate-500">Buyer relevance</dt>
              <dd className="font-mono text-2xl font-semibold">
                {issue.relevance}
                <span className="text-base font-normal text-slate-500"> of 3</span>
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-sm text-slate-500">Business impact</dt>
              <dd className="font-mono text-2xl font-semibold">
                {issue.impact}
                <span className="text-base font-normal text-slate-500"> of 3</span>
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-sm text-slate-500">Evidence strength</dt>
              <dd className="text-2xl font-semibold">{STRENGTH_LABELS[issue.evidenceStrength]}</dd>
            </div>
          </dl>
        </Field>

        <Field label="Destination">{action.destination}</Field>

        <Field label="Content check">
          <p className="font-medium">{CONTENT_CHECK_LABELS[action.contentCheckResult]}</p>
          {action.contentCheckNote && action.contentCheckResult !== "not_applicable" && (
            <p className="text-sm text-slate-600">{action.contentCheckNote}</p>
          )}
        </Field>

        <Field label="Recommended action">
          <p className="font-medium">{OUTCOME_LABELS[action.outcome]}</p>
          <p>{action.recommendedAction}</p>
        </Field>

        <Field label="Reason">{action.reason}</Field>

        <Field label="Draft and status">
          {action.outcome === "correction" && latestDraft ? (
            <DraftEditor
              actionId={action.id}
              initialAction={action}
              initialDraft={latestDraft}
              facts={bundle.facts}
              brandName={brand.name}
            />
          ) : (
            <p className="text-slate-600">
              No draft. {action.outcome === "no_correction" ? "Nothing needs to change right now." : "This needs checking before anything is written."} MarCo
              only drafts content when the diagnosis shows it&apos;s needed.
            </p>
          )}
        </Field>
      </div>
    </div>
  );
}
