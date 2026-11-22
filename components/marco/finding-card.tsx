import { EvidenceQuote } from "@/components/marco/evidence-quote";
import { FindingBadge } from "@/components/marco/finding-badge";
import type { Finding } from "@/lib/results";
import { FOCUS_AREA_LABELS } from "@/lib/types";

function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** One finding: badge, the AI's exact words, sources, and why it matters. */
export function FindingCard({ finding }: { finding: Finding }) {
  const factHref = finding.fact ? safeHref(finding.fact.sourceUrl) : null;
  return (
    <article className="space-y-4 rounded-xl border bg-card p-6 transition-shadow hover:shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <FindingBadge kind={finding.kind} potential={finding.potential} />
        <span className="text-sm text-slate-500">{FOCUS_AREA_LABELS[finding.focusArea]}</span>
      </div>
      <h3 className="font-semibold text-slate-900">{finding.title}</h3>
      <EvidenceQuote
        quote={finding.quote}
        attribution={`AI answer to: “${finding.question}”`}
        sources={finding.citations}
        whyItMatters={finding.whyItMatters}
      />
      {finding.fact && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-slate-700">
          <span className="font-medium">Your website says: </span>
          {finding.fact.value}.{" "}
          {factHref && (
            <a href={factHref} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-indigo-600 hover:underline">
              Source
            </a>
          )}
        </p>
      )}
    </article>
  );
}
