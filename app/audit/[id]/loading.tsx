import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <p className="flex items-center gap-2 text-slate-600" role="status">
      <Loader2 className="size-5 animate-spin text-indigo-600" aria-hidden="true" />
      Loading your audit…
    </p>
  );
}
