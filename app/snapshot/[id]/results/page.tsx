import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronDown, FlaskConical, Info } from "lucide-react";
import { EvidenceQuote } from "@/components/marco/evidence-quote";
import { FindingBadge } from "@/components/marco/finding-badge";
import { FindingCard } from "@/components/marco/finding-card";
import { MetricTile } from "@/components/marco/metric-tile";
import { Button } from "@/components/ui/button";
import { buildSnapshotResults } from "@/lib/results";
import { getSnapshotBundle } from "@/lib/store";
import { FOCUS_AREA_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Your free snapshot · MarCo" };

export default async function SnapshotResultsPage(props: PageProps<"/snapshot/[id]/results">) {
  const { id } = await props.params;
  const bundle = await getSnapshotBundle(id);
  if (!bundle?.brand) notFound();
  if (bundle.progress?.status !== "done") redirect(`/snapshot/${id}`);

  const { brand, runs } = bundle;
  const results = buildSnapshotResults(bundle);
  // Label by the mode that actually produced these answers.
  const isMock = runs.some((r) => r.mode === "MOCK");
  const date = new Date(bundle.audit.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" });

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">Free snapshot</p>
        <h1 className="text-3xl font-semibold tracking-tight">How AI describes {brand.name}</h1>
        <p className="text-sm text-slate-500">
          Based on {runs.length} AI answers · {date}
        </p>
        {isMock && (
          <p className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Sample results for {brand.name}, a fictional company. You entered{" "}
              <span className="break-all font-medium">{brand.url}</span>; no real audit was run.
            </span>
          </p>
        )}
        <p className="flex items-start gap-2 text-sm text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          These findings are potential: they compare AI answers with facts read from your website, which you haven&apos;t
          confirmed yet. A missing mention is a gap, not an error.
        </p>
      </header>

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

      <section className="space-y-4" aria-labelledby="top-findings">
        <div className="space-y-1">
          <h2 id="top-findings" className="text-xl font-semibold tracking-tight">
            Top {results.topFindings.length || ""} potential findings
          </h2>
          <p className="text-sm text-slate-500">The issues most likely to matter to buyers, with the AI&apos;s exact words.</p>
        </div>
        {results.topFindings.length > 0 ? (
          <div className="grid gap-4">
            {results.topFindings.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border p-6 text-slate-600">
            No potential issues showed up in this sample of answers. That&apos;s a good sign, but a sample of 10 answers
            can miss things; the full audit checks more.
          </p>
        )}
      </section>

      <section aria-labelledby="all-answers">
        <details className="group rounded-xl border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-6 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
            <span>
              <span id="all-answers" className="block text-xl font-semibold tracking-tight">
                See all {runs.length} answers
              </span>
              <span className="text-sm text-slate-500">Every question we asked and the AI&apos;s full answer.</span>
            </span>
            <ChevronDown className="size-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ol className="space-y-4 border-t p-4 sm:p-6">
            {results.answers.map(({ run, prompt, findings }, i) => (
              <li key={run.id} className="space-y-3 rounded-lg border p-4 sm:p-5">
                <p className="text-sm text-slate-500">
                  Question {i + 1} · {FOCUS_AREA_LABELS[prompt.focusArea]} ·{" "}
                  {prompt.type === "discovery" ? "Discovery (doesn't name you)" : "About your company"}
                </p>
                <h3 className="font-semibold text-slate-900">{run.promptText}</h3>
                <EvidenceQuote quote={run.answer ?? ""} sources={run.rawCitations} />
                {findings.length > 0 ? (
                  <ul className="space-y-2">
                    {findings.map((f) => (
                      <li key={f.id} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                        <FindingBadge kind={f.kind} potential={f.potential} className="self-start" />
                        <span className="text-sm text-slate-700">
                          {f.kind === "visibility_gap"
                            ? `${brand.name} wasn't included.`
                            : f.kind === "coverage_gap"
                              ? `Left out: ${f.fact?.value ?? "a relevant fact"}.`
                              : `“${f.quote}”`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No findings for this answer.</p>
                )}
              </li>
            ))}
          </ol>
        </details>
      </section>

      <section className="space-y-4 rounded-xl border bg-slate-50 p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Go from findings to fixes</h2>
          <p className="text-slate-600">
            Confirm your facts, run a deeper audit on one focus area, and get a specific, evidence-backed correction you
            can review and publish yourself.
          </p>
        </div>
        <Button asChild size="lg" className="h-auto w-full py-3 text-center whitespace-normal sm:w-auto">
          <Link href={`/signup?snapshot=${encodeURIComponent(id)}`}>
            Create a free account to see the full audit and get your first correction
          </Link>
        </Button>
      </section>
    </div>
  );
}
