import { BadgeCheck, Clock, Download, Pencil, Send, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionStatus } from "@/lib/types";

const STYLES: Record<ActionStatus, { icon: LucideIcon; className: string }> = {
  Draft: { icon: Pencil, className: "bg-slate-50 text-slate-700 border-slate-200" },
  "In review": { icon: Clock, className: "bg-amber-50 text-amber-900 border-amber-200" },
  Approved: { icon: BadgeCheck, className: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  Exported: { icon: Download, className: "bg-sky-50 text-sky-800 border-sky-200" },
  // Published is set ONLY by the customer ("Mark as published").
  Published: { icon: Send, className: "bg-green-50 text-green-800 border-green-200" },
};

type Props = { status: ActionStatus; className?: string };

/** Status of a corrective action. Icon + text, never color alone. */
export function StatusPill({ status, className }: Props) {
  const { icon: Icon, className: tone } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {status}
    </span>
  );
}
