import { ChevronDown } from "lucide-react";
import { EvidenceQuote } from "@/components/marco/evidence-quote";
import { FindingBadge } from "@/components/marco/finding-badge";
import type { AnswerView } from "@/lib/results";
import { FOCUS_AREA_LABELS } from "@/lib/types";

function Findings({ findings, brandName }: { findings: AnswerView["findings"]; brandName: string }) {
  if (findings.length === 0) return <p className="text-sm text-slate-500">No findings for this answer.</p>;
  return (
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
  );
}

/**
 * Collapsible list of every answer with its findings. Snapshots list each
 * question once; deep audits group the 3 runs under each of the 5 questions.
 */
export function AnswersList({
  answers,
  brandName,
  deep = false,
}: {
  answers: AnswerView[];
  brandName: string;
  deep?: boolean;
}) {
  // Group runs by question, keeping the order the questions were asked.
  const groups: AnswerView[][] = [];
  for (const a of answers) {
    const g = groups.find((x) => x[0].prompt.id === a.prompt.id);
    if (g) g.push(a);
    else groups.push([a]);
  }

  return (
    <section aria-labelledby="all-answers">
      <details className="group rounded-xl border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-6 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <span>
            <span id="all-answers" className="block text-xl font-semibold tracking-tight">
              {deep ? `Results by question` : `See all ${answers.length} answers`}
            </span>
            <span className="text-sm text-slate-500">
              {deep
                ? `${groups.length} questions, ${answers.length} answers, with the AI’s full words for every run.`
                : "Every question we asked and the AI’s full answer."}
            </span>
          </span>
          <ChevronDown
            className="size-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <ol className="space-y-4 border-t p-4 sm:p-6">
          {groups.map((runs, i) => {
            const { prompt } = runs[0];
            return (
              <li key={prompt.id} className="space-y-3 rounded-lg border p-4 sm:p-5">
                <p className="text-sm text-slate-500">
                  Question {i + 1} · {FOCUS_AREA_LABELS[prompt.focusArea]} ·{" "}
                  {prompt.type === "discovery" ? "Discovery (doesn't name you)" : "About your company"}
                </p>
                <h3 className="font-semibold text-slate-900">{runs[0].run.promptText}</h3>
                {runs.map(({ run, findings }) => (
                  <div key={run.id} className="space-y-3 border-t pt-3 first-of-type:border-t-0 first-of-type:pt-0">
                    {deep && <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Run {run.runNumber}</p>}
                    <EvidenceQuote quote={run.answer ?? ""} sources={run.rawCitations} />
                    <Findings findings={findings} brandName={brandName} />
                  </div>
                ))}
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}
