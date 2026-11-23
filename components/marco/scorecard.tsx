import { MetricTile } from "@/components/marco/metric-tile";
import type { Metric } from "@/lib/scorecard";

const GROUPS: { title: string; description: string; ids: string[] }[] = [
  {
    title: "Are you mentioned?",
    description: "In answers to buyer questions that don't name you.",
    ids: ["unaided-mention", "competitor-inclusion"],
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

/** Separate metrics in three plain-language groups. Never a combined score. */
export function Scorecard({ metrics }: { metrics: Metric[] }) {
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
