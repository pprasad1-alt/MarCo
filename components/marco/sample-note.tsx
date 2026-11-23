import { FlaskConical } from "lucide-react";

/**
 * Quiet reminder under a page title that these results are sample data.
 * The yellow mode banner at the top of every page is the main signal.
 */
export function SampleNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-sm text-slate-500">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-yellow-700" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
