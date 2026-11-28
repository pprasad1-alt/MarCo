import { MetricTile } from "@/components/marco/metric-tile";
import type { CompetitorMention, Metric } from "@/lib/scorecard";

const GROUPS: { title: string; description: string; ids: string[] }[] = [
  {
    title: "Are you mentioned?",
    description: "In answers to buyer questions that don't name you.",
    ids: ["unaided-mention"],
  },
  {
    title: "Is it accurate?",
    description: "What AI says about you, checked against your facts.",
    ids: ["verified-accuracy", "unsupported-claims", "coverage-gaps"],
  },
  {
    title: "Is there evidence?",
    description: "Whether AI answers listed the sources they used.",
    ids: ["citations-discovery", "citations-fact"],
  },
];

/** Who was named in discovery answers, one row each, with the brand on the same list. */
export function CompetitorList({ rows }: { rows: CompetitorMention[] }) {
  if (rows.length === 0) return null;
  const total = rows[0].total;
  return (
    <div className="space-y-3 rounded-xl border bg-card p-6">
      <div>
        <h4 className="text-sm font-medium text-slate-600">Who AI named</h4>
        <p className="text-sm text-slate-500">In {total} discovery answers that don&apos;t name you.</p>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={r.isBrand ? "font-semibold text-slate-900" : "text-slate-700"}>
                {r.name}
                {r.isBrand && <span className="font-normal text-slate-500"> (you)</span>}
              </span>
              <span className="font-mono text-slate-800">
                {r.count} of {r.total}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100" aria-hidden="true">
              <div
                className={r.isBrand ? "h-1.5 rounded-full bg-indigo-600" : "h-1.5 rounded-full bg-slate-400"}
                style={{ width: `${r.total ? (r.count / r.total) * 100 : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Separate metrics in three plain-language groups. Never a combined score. */
export function Scorecard({ metrics, competitors = [] }: { metrics: Metric[]; competitors?: CompetitorMention[] }) {
  const byId = new Map(metrics.map((m) => [m.id, m]));
  const used = new Set(GROUPS.flatMap((g) => g.ids));
  const other = metrics.filter((m) => !used.has(m.id));
  const groups = [...GROUPS, ...(other.length ? [{ title: "Other", description: "", ids: other.map((m) => m.id) }] : [])];
  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const items = g.ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
        if (items.length === 0) return null;
        return (
          <div key={g.title} className="space-y-3">
            <div>
              <h3 className="font-semibold text-slate-900">{g.title}</h3>
              {g.description && <p className="text-sm text-slate-500">{g.description}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((m) => (
                <MetricTile key={m.id} {...m} />
              ))}
              {g.ids.includes("unaided-mention") && <CompetitorList rows={competitors} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
