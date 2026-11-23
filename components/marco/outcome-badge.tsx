import { CircleMinus, PenLine, Search, type LucideIcon } from "lucide-react";
import { OUTCOME_LABELS } from "@/lib/findings";
import { cn } from "@/lib/utils";
import type { ActionOutcome } from "@/lib/types";

const STYLES: Record<ActionOutcome, { icon: LucideIcon; className: string }> = {
  correction: { icon: PenLine, className: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  investigate: { icon: Search, className: "bg-slate-50 text-slate-700 border-slate-300" },
  no_correction: { icon: CircleMinus, className: "bg-white text-slate-600 border-slate-200" },
};

/** What MarCo recommends doing about an issue. Icon + text, never color alone. */
export function OutcomeBadge({ outcome, className }: { outcome: ActionOutcome; className?: string }) {
  const { icon: Icon, className: tone } = STYLES[outcome];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm font-medium", tone, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {OUTCOME_LABELS[outcome]}
    </span>
  );
}
