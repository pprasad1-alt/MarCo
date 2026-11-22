import { FlaskConical, Search, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModeInfo, Mode } from "@/lib/mode";

const STYLES: Record<Mode, { icon: LucideIcon; className: string }> = {
  MOCK: { icon: FlaskConical, className: "bg-yellow-100 text-yellow-900 border-yellow-300" },
  SIMULATION: { icon: TriangleAlert, className: "bg-amber-100 text-amber-950 border-amber-300" },
  GEMINI_AUDIT: { icon: Search, className: "bg-slate-50 text-slate-700 border-slate-200" },
};

type Props = {
  mode: Pick<ModeInfo, "mode" | "label" | "bannerText">;
  className?: string;
};

/** Full-width strip that tells the user which mode produced the results. */
export function ModeBanner({ mode, className }: Props) {
  const { icon: Icon, className: tone } = STYLES[mode.mode];
  const showLabel = mode.label !== mode.bannerText;
  return (
    <div role="note" aria-label="Audit mode" className={cn("w-full border-b text-sm", tone, className)}>
      <div className="mx-auto flex max-w-[960px] items-center gap-2 px-4 py-2 sm:px-6">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <p>
          {showLabel && <span className="font-semibold">{mode.label}: </span>}
          {mode.bannerText}
        </p>
      </div>
    </div>
  );
}
