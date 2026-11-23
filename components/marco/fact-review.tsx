"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FACT_TYPE_LABELS } from "@/lib/findings";
import { cn } from "@/lib/utils";
import type { Fact } from "@/lib/types";

type Decision = "confirm" | "reject" | "skip";
type Row = { fact: Fact; decision: Decision; value: string; editing: boolean };

function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function initialDecision(f: Fact): Decision {
  if (f.rejected) return "reject";
  return f.confirmed ? "confirm" : "skip";
}

export function FactReview({ brandId, snapshotId, facts }: { brandId: string; snapshotId: string; facts: Fact[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() =>
    facts.map((fact) => ({ fact, decision: initialDecision(fact), value: fact.value, editing: false })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.fact.id === id ? { ...r, ...patch } : r)));

  const counts = {
    confirm: rows.filter((r) => r.decision === "confirm").length,
    reject: rows.filter((r) => r.decision === "reject").length,
    skip: rows.filter((r) => r.decision === "skip").length,
  };

  async function save() {
    setError(null);
    if (rows.some((r) => !r.value.trim())) return setError("A fact can't be empty. Fix it or reject it.");
    if (counts.confirm === 0) return setError("Confirm at least one fact so MarCo has something to check AI answers against.");
    setSaving(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/facts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: rows.map((r) => ({ id: r.fact.id, decision: r.decision, value: r.value.trim() })) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "We couldn't save your facts. Please try again.");
      router.push(`/snapshot/${snapshotId}/focus`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save your facts. Please try again.");
      setSaving(false);
    }
  }

  if (rows.length === 0) {
    return <p className="rounded-xl border p-6 text-slate-600">We didn&apos;t find any facts on your website to review.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          <span className="font-mono">{counts.confirm}</span> confirmed · <span className="font-mono">{counts.reject}</span> rejected ·{" "}
          <span className="font-mono">{counts.skip}</span> not reviewed
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRows((rs) => rs.map((r) => (r.decision === "skip" ? { ...r, decision: "confirm" } : r)))}
          disabled={counts.skip === 0}
        >
          Confirm all not reviewed
        </Button>
      </div>

      <ul className="space-y-3">
        {rows.map((r) => {
          const href = safeHref(r.fact.sourceUrl);
          const inputId = `fact-${r.fact.id}`;
          return (
            <li
              key={r.fact.id}
              className={cn(
                "space-y-3 rounded-xl border p-4 sm:p-5",
                r.decision === "confirm" && "border-green-300 bg-green-50/40",
                r.decision === "reject" && "border-slate-200 bg-slate-50",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span>{FACT_TYPE_LABELS[r.fact.factType]}</span>
                <span className="flex items-center gap-1.5 font-medium">
                  {r.decision === "confirm" && (
                    <>
                      <Check className="size-4 text-green-700" aria-hidden="true" />
                      <span className="text-green-800">Confirmed</span>
                    </>
                  )}
                  {r.decision === "reject" && (
                    <>
                      <X className="size-4 text-slate-600" aria-hidden="true" />
                      <span className="text-slate-700">Rejected: won&apos;t be used</span>
                    </>
                  )}
                  {r.decision === "skip" && <span className="text-slate-500">Not reviewed</span>}
                </span>
              </div>

              {r.editing ? (
                <div className="space-y-1">
                  <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
                    Edit this fact
                  </label>
                  <input
                    id={inputId}
                    value={r.value}
                    maxLength={300}
                    onChange={(e) => update(r.fact.id, { value: e.target.value })}
                    className="h-10 w-full rounded-md border border-input px-3 text-base focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none"
                  />
                </div>
              ) : (
                <p className={cn("text-base text-slate-900", r.decision === "reject" && "text-slate-500 line-through")}>{r.value}</p>
              )}

              <p className="text-sm break-all text-slate-500">
                Found on:{" "}
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-indigo-600 hover:underline">
                    {r.fact.sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                ) : (
                  r.fact.sourceUrl
                )}
                {r.value !== r.fact.value && <span className="text-slate-500"> · edited</span>}
              </p>

              <div className="flex flex-wrap gap-2" role="group" aria-label={`Decision for: ${r.value}`}>
                <Button
                  size="sm"
                  variant={r.decision === "confirm" ? "default" : "outline"}
                  aria-pressed={r.decision === "confirm"}
                  onClick={() => update(r.fact.id, { decision: r.decision === "confirm" ? "skip" : "confirm", editing: false })}
                >
                  <Check aria-hidden="true" /> {r.decision === "confirm" ? "Confirmed" : "Confirm"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => update(r.fact.id, { editing: !r.editing })}>
                  <Pencil aria-hidden="true" /> {r.editing ? "Done editing" : "Edit"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  aria-pressed={r.decision === "reject"}
                  onClick={() => update(r.fact.id, { decision: r.decision === "reject" ? "skip" : "reject", editing: false })}
                >
                  <X aria-hidden="true" /> {r.decision === "reject" ? "Undo reject" : "Reject"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Facts you don&apos;t confirm stay unconfirmed, and findings about them stay “potential”.</p>
        <Button size="lg" onClick={save} disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          Save and choose a focus area
        </Button>
      </div>
    </div>
  );
}
