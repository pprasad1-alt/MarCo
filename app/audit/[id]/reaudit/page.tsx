import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, Send } from "lucide-react";
import { JourneySteps } from "@/components/marco/journey-steps";
import { LocalDate } from "@/components/marco/local-date";
import { ReauditButton } from "@/components/marco/reaudit-button";
import { SampleNote } from "@/components/marco/sample-note";
import { getPrompt } from "@/lib/prompts";
import { bundleFrom, readStore } from "@/lib/store";
import { FOCUS_AREA_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Re-audit · MarCo" };

function describeSettings(settings: Record<string, unknown>): string {
  const entries = Object.entries(settings);
  return entries.length ? entries.map(([k, v]) => `${k}: ${String(v)}`).join(", ") : "Default";
}

export default async function ReauditPage(props: PageProps<"/audit/[id]/reaudit">) {
  const { id } = await props.params;
  const data = await readStore({ auditId: id });
  const opened = bundleFrom(data, id);
  if (!opened?.brand) notFound();
  // Always show the original deep audit as the baseline.
  const baselineId = opened.audit.type === "re_audit" ? opened.audit.baselineAuditId : opened.audit.id;
  if (opened.audit.type === "snapshot" || !baselineId) redirect(`/snapshot/${id}/results`);
  const baseline = bundleFrom(data, baselineId)!;
  if (baseline.progress?.status !== "done") redirect(`/audit/${baselineId}`);

  const { audit, runs, brand } = baseline;
  const questions = [...new Map(runs.map((r) => [r.promptId, r])).values()];
  const models = [...new Set(runs.map((r) => r.modelId))].join(", ");
  const grounding = describeSettings(runs[0]?.groundingSettings ?? {});
  const generation = describeSettings(runs[0]?.generationSettings ?? {});
  const published = baseline.actions.filter((a) => a.status === "Published");
  const previous = data.audits
    .filter((a) => a.type === "re_audit" && a.baselineAuditId === baselineId)
    .filter((a) => data.progress.find((p) => p.auditId === a.id)?.status === "done");
  const isMock = runs.some((r) => r.mode === "MOCK");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <JourneySteps current="Re-audit" />
      <Link
        href={`/audit/${baselineId}/report`}
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to the report
      </Link>
      <header className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">
          Re-audit · {audit.focusArea ? FOCUS_AREA_LABELS[audit.focusArea] : ""}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Check whether AI answers have changed</h1>
        <p className="text-slate-600">
          A re-audit asks the same {questions.length} questions, 3 fresh times each, and compares the answers with your
          saved baseline.
        </p>
        {isMock && <SampleNote>Sample data for {brand!.name}, a fictional company.</SampleNote>}
      </header>

      <section aria-labelledby="baseline" className="space-y-4 rounded-xl border p-5 sm:p-6">
        <h2 id="baseline" className="text-xl font-semibold tracking-tight">
          Saved baseline
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-slate-500">Date</dt>
          <dd className="text-slate-900">
            <LocalDate iso={audit.createdAt} withTime />
          </dd>
          <dt className="text-slate-500">AI model</dt>
          <dd className="font-mono text-slate-900">{models}</dd>
          <dt className="text-slate-500">Search grounding</dt>
          <dd className="text-slate-900">{grounding}</dd>
          <dt className="text-slate-500">Generation settings</dt>
          <dd className="text-slate-900">{generation}</dd>
          <dt className="text-slate-500">Answers</dt>
          <dd className="text-slate-900">
            {runs.length} ({questions.length} questions × 3 runs)
          </dd>
        </dl>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">The {questions.length} questions</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
            {questions.map((r) => (
              <li key={r.promptId}>
                {r.promptText}{" "}
                <span className="text-slate-500">(version {getPrompt(r.promptId).version})</span>
              </li>
            ))}
          </ol>
        </details>
      </section>

      {published.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-slate-900">Corrections you marked as published</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {published.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <Send className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden="true" />
                {baseline.issues.find((i) => i.id === a.issueId)?.observedIssue}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-3 rounded-xl border-2 border-indigo-100 bg-indigo-50/40 p-5 sm:p-6">
        <p className="flex items-start gap-2 text-sm text-slate-700">
          <Clock className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
          Corrections usually take a few weeks to be picked up. Results are directional: a sample of 15 answers can
          change by chance.
        </p>
        <ReauditButton auditId={baselineId} label="Run re-audit with the same 5 questions" primary />
      </div>

      {previous.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-slate-900">Earlier re-audits</h2>
          <ul className="space-y-1 text-sm">
            {previous.map((a) => (
              <li key={a.id}>
                <Link href={`/audit/${a.id}/report`} className="text-indigo-600 hover:underline">
                  Re-audit from <LocalDate iso={a.createdAt} withTime />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
