import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const JOURNEY = ["Snapshot", "Confirm facts", "Deep audit", "Fix", "Re-audit"] as const;
export type JourneyStep = (typeof JOURNEY)[number];

/**
 * Where the customer is in MarCo's flow. Phones get a compact "Step 3 of 5"
 * line with a segmented bar; wider screens show every step's name.
 */
export function JourneySteps({ current }: { current: JourneyStep }) {
  const idx = JOURNEY.indexOf(current);
  return (
    <nav aria-label="Your progress" className="space-y-2">
      <p className="text-sm text-slate-600 sm:hidden">
        Step {idx + 1} of {JOURNEY.length} · <span className="font-medium text-slate-900">{current}</span>
      </p>
      <div className="flex gap-1 sm:hidden" aria-hidden="true">
        {JOURNEY.map((s, i) => (
          <span key={s} className={cn("h-1 flex-1 rounded-full", i <= idx ? "bg-indigo-600" : "bg-slate-200")} />
        ))}
      </div>
      <ol className="hidden flex-wrap items-center gap-x-2 gap-y-2 text-sm sm:flex">
        {JOURNEY.map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          return (
            <li key={s} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium",
                  state === "done" && "border-indigo-600 bg-indigo-600 text-white",
                  state === "current" && "border-indigo-600 text-indigo-700",
                  state === "todo" && "border-slate-300 text-slate-400",
                )}
              >
                {state === "done" ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span className={cn(state === "todo" ? "text-slate-400" : state === "current" ? "font-medium text-slate-900" : "text-slate-600")}>
                {s}
                {state === "done" && <span className="sr-only"> (done)</span>}
              </span>
              {i < JOURNEY.length - 1 && <span aria-hidden="true" className="mx-1 h-px w-4 bg-slate-200" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
