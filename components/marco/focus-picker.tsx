"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOCUS_AREA_DESCRIPTIONS } from "@/lib/findings";
import { cn } from "@/lib/utils";
import { FOCUS_AREA_LABELS, type FocusArea } from "@/lib/types";

type Option = { area: FocusArea; findings: number; available: boolean; unavailableReason?: string };

export function FocusPicker({ snapshotId, options }: { snapshotId: string; options: Option[] }) {
  const router = useRouter();
  const firstAvailable = [...options].filter((o) => o.available).sort((a, b) => b.findings - a.findings)[0]?.area ?? null;
  const [selected, setSelected] = useState<FocusArea | null>(firstAvailable);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function start() {
    if (!selected) return setError("Choose a focus area.");
    setError(null);
    setStarting(true);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId, focusArea: selected }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.auditId) throw new Error(body.error ?? "We couldn't start the deep audit. Please try again.");
      router.push(`/audit/${body.auditId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't start the deep audit. Please try again.");
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="sr-only">Focus area</legend>
        {options.map((o) => (
          <label
            key={o.area}
            className={cn(
              "flex gap-3 rounded-xl border p-4 sm:p-5",
              o.available ? "cursor-pointer hover:bg-slate-50" : "cursor-not-allowed bg-slate-50 text-slate-400",
              selected === o.area && "border-indigo-600 ring-1 ring-indigo-600",
            )}
          >
            <input
              type="radio"
              name="focus"
              value={o.area}
              checked={selected === o.area}
              disabled={!o.available}
              onChange={() => setSelected(o.area)}
              className="mt-1 size-4 accent-indigo-600"
            />
            <span className="space-y-1">
              <span className={cn("block font-semibold", o.available ? "text-slate-900" : "text-slate-500")}>
                {FOCUS_AREA_LABELS[o.area]}
              </span>
              <span className={cn("block text-sm", o.available ? "text-slate-600" : "text-slate-500")}>
                {FOCUS_AREA_DESCRIPTIONS[o.area]}
              </span>
              <span className="block text-sm text-slate-500">
                {o.available
                  ? o.findings > 0
                    ? `${o.findings} potential ${o.findings === 1 ? "finding" : "findings"} in your snapshot`
                    : "No findings in your snapshot"
                  : o.unavailableReason}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">5 buyer questions, each asked 3 times. Takes about a minute.</p>
        <Button size="lg" onClick={start} disabled={starting || !selected}>
          {starting && <Loader2 className="animate-spin" aria-hidden="true" />}
          Run deep audit
        </Button>
      </div>
    </div>
  );
}
