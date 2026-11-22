"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover as PopoverPrimitive } from "radix-ui";

type Props = {
  /** Metric name in sentence case, e.g. "Unaided brand mention rate". */
  label: string;
  /** e.g. 3 in "3 of 10". */
  count: number;
  /** e.g. 10 in "3 of 10". 0 means nothing to measure, shown as "N/A". */
  total: number;
  /** One-line plain-English explanation shown under the number. */
  explanation: string;
  /** How it's calculated, shown in the info popover (opens on hover, tap or click). */
  howCalculated: string;
  /** Shown instead of the explanation when the metric is N/A. */
  notApplicableReason?: string;
  className?: string;
};

/** Counts are always shown with rates. Never combined into a single score. */
export function MetricTile({ label, count, total, explanation, howCalculated, notApplicableReason, className }: Props) {
  // A popover rather than a hover-only tooltip, so it also works on phones.
  const [open, setOpen] = useState(false);
  const notApplicable = total === 0;
  const rate = notApplicable ? null : Math.round((count / total) * 100);

  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border bg-card p-6 transition-shadow hover:shadow-sm", className)}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-600">{label}</h3>
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger
            onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
            className="-m-1 rounded-md p-1 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={`How "${label}" is calculated`}
          >
            <Info className="size-4" aria-hidden="true" />
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              side="top"
              sideOffset={6}
              collisionPadding={16}
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="z-50 max-w-64 rounded-md bg-slate-900 px-3 py-2 text-sm text-white shadow-md"
            >
              {howCalculated}
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      </div>

      {notApplicable ? (
        <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900">N/A</p>
      ) : (
        <div>
          <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900">
            {count} <span className="text-xl font-normal text-slate-500">of</span> {total}
          </p>
          <p className="font-mono text-sm text-slate-500">{rate}%</p>
        </div>
      )}

      <p className="text-sm text-slate-600">{notApplicable ? (notApplicableReason ?? "Nothing to measure yet.") : explanation}</p>
    </div>
  );
}
