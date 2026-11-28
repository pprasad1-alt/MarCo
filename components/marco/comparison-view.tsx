import { ArrowDown, ArrowUp, Info, Minus, Send, TriangleAlert } from "lucide-react";
import { FindingBadge } from "@/components/marco/finding-badge";
import { LocalDate } from "@/components/marco/local-date";
import { ISSUE_CHANGE_LABELS, type Comparison, type MetricChange } from "@/lib/compare";

function pct(n: { count: number; total: number }) {
  return n.total === 0 ? "N/A" : `${n.count} of ${n.total} (${Math.round((n.count / n.total) * 100)}%)`;
}

function Direction({ m }: { m: MetricChange }) {
  if (m.direction === "not_comparable") return <span className="text-slate-500">Not comparable</span>;
  if (m.direction === "same")
    return (
      <span className="inline-flex items-center gap-1 text-slate-700">
        <Minus className="size-4" aria-hidden="true" /> No observed change
      </span>
    );
  const Icon = m.direction === "up" ? ArrowUp : ArrowDown;
  const better = m.higherIsBetter === null ? null : (m.direction === "up") === m.higherIsBetter;
  return (
    <span
      className={`inline-flex items-center gap-1 ${better === null ? "text-slate-700" : better ? "text-green-800" : "text-red-800"}`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {m.direction === "up" ? "Up" : "Down"}
      {better !== null && <span>({better ? "in the right direction" : "in the wrong direction"})</span>}
    </span>
  );
}

/** Baseline vs re-audit. Directional wording only; a 15-answer sample can move by chance. */
export function ComparisonView({ comparison, baselineDate }: { comparison: Comparison; baselineDate: string }) {
  const { summary, warnings, metrics, issues, published } = comparison;
  return (
    <section className="space-y-6 rounded-xl border p-5 sm:p-6" aria-labelledby="comparison">
      <div className="space-y-1">
        <h2 id="comparison" className="text-xl font-semibold tracking-tight">
          Compared with your baseline
        </h2>
        <p className="text-sm text-slate-500">
          Baseline deep audit from <LocalDate iso={baselineDate} />. Same 5 questions, 3 runs each.
        </p>
      </div>

      <div className="space-y-2 text-slate-800">
        {summary.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
        AI answers vary from one run to the next, and 15 answers is a small sample. Treat changes as directional, not as
        proof that a correction worked. Corrections usually take a few weeks to be picked up.
      </p>

      {warnings.length > 0 && (
        <div
          role="note"
          className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> These results aren&apos;t directly
            comparable
          </p>
          <ul className="list-disc space-y-1 pl-6">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {published.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Corrections you marked as published</h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {published.map((p) => (
              <li key={p.observedIssue} className="flex items-start gap-2">
                <Send className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden="true" />
                <span>
                  {p.observedIssue}{" "}
                  <span className="text-slate-500">
                    (on <LocalDate iso={p.publishedAt} />)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Issues</h3>
        {issues.length === 0 ? (
          <p className="text-sm text-slate-600">No issues in either audit.</p>
        ) : (
          <ul className="space-y-2">
            {issues.map((i) => (
              <li key={i.key} className="space-y-2 rounded-lg border p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <FindingBadge kind={i.kind} />
                  <span className="text-sm font-medium text-slate-800">{ISSUE_CHANGE_LABELS[i.change]}</span>
                </div>
                <p className="text-sm text-slate-800">{i.observedIssue}</p>
                <p className="font-mono text-sm text-slate-500">
                  {i.before} → {i.after} answers
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Scorecard, baseline vs re-audit</h3>
        {/* Table on wider screens, stacked cards on phones. Unchanged rows are kept. */}
        <table className="hidden w-full text-left text-sm sm:table">
          <thead className="border-b text-slate-500">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">
                Metric
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Baseline
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Re-audit
              </th>
              <th scope="col" className="py-2 font-medium">
                Change
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {metrics.map((m) => (
              <tr key={m.id}>
                <th scope="row" className="py-2 pr-3 font-normal text-slate-800">
                  {m.label}
                </th>
                <td className="py-2 pr-3 font-mono text-slate-600">{pct(m.before)}</td>
                <td className="py-2 pr-3 font-mono text-slate-600">{pct(m.after)}</td>
                <td className="py-2">
                  <Direction m={m} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="grid gap-2 sm:hidden">
          {metrics.map((m) => (
            <li key={m.id} className="space-y-1 rounded-lg border p-3 text-sm">
              <p className="font-medium text-slate-800">{m.label}</p>
              <p className="font-mono text-slate-600">
                {pct(m.before)} → {pct(m.after)}
              </p>
              <Direction m={m} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
