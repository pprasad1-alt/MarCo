import { cn } from "@/lib/utils";
import { FINDING_STYLES, findingLabel } from "@/lib/findings";
import type { FindingKind } from "@/lib/types";

type Props = {
  kind: FindingKind;
  /** True before facts are confirmed: shows e.g. "Potential inaccuracy". */
  potential?: boolean;
  className?: string;
};

/** Icon + text + color. Looks the same on every screen. */
export function FindingBadge({ kind, potential = false, className }: Props) {
  const style = FINDING_STYLES[kind];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium whitespace-nowrap",
        style.className,
        className,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {findingLabel(kind, potential)}
    </span>
  );
}
