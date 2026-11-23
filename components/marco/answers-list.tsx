import { ChevronDown } from "lucide-react";
import { EvidenceQuote } from "@/components/marco/evidence-quote";
import { FindingBadge } from "@/components/marco/finding-badge";
import type { AnswerView } from "@/lib/results";
import { FOCUS_AREA_LABELS } from "@/lib/types";

/** Collapsible list of every question asked and the AI's full answer, with its findings. */
export function AnswersList({ answers, brandName, deep = false }: { answers: AnswerView[]; brandName: string; deep?: boolean }) {
  return (
        <section aria-labelledby="all-answers">
          <details className="group rounded-xl border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-6 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span>
                <span id="all-answers" className="block text-xl font-semibold tracking-tight">
                  See all {answers.length} answers
                </span>
                <span className="text-sm text-slate-500">{deep ? "Every run of every question, with the AI\u2019s full answer." : "Every question we asked and the AI\u2019s full answer."}</span>
              </span>
              <ChevronDown className="size-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ol className="space-y-4 border-t p-4 sm:p-6">
              {answers.map(({ run, prompt, findings }, i) => (
                <li key={run.id} className="space-y-3 rounded-lg border p-4 sm:p-5">
                  <p className="text-sm text-slate-500">
                    {deep ? `Answer ${i + 1} · run ${run.runNumber} of this question` : `Question ${i + 1}`} · {FOCUS_AREA_LABELS[prompt.focusArea]} ·{" "}
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
                              ? `${brandName} wasn't included.`
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
  );
}
