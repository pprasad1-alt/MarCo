import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="text-slate-600">The link may be old, or the snapshot may have expired. You can start a new one.</p>
      <Button asChild>
        <Link href="/">Run a free snapshot</Link>
      </Button>
    </div>
  );
}
