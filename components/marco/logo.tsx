import { cn } from "@/lib/utils";

/**
 * MarCo logo. Placeholder wordmark until the real logo arrives:
 * to swap it in, put the file in /public (e.g. /public/logo.svg) and replace the
 * mark below with <Image src="/logo.svg" alt="MarCo" width={…} height={…} />.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
        M
      </span>
      <span className="text-lg font-semibold tracking-tight text-slate-900">MarCo</span>
    </span>
  );
}
