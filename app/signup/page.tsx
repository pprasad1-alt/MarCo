import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Create your free account · MarCo" };

// Placeholder until accounts (Supabase) are added. For the demo, the full audit
// continues without an account.
export default async function SignupPage(props: PageProps<"/signup">) {
  const { snapshot } = await props.searchParams;
  const snapshotId = typeof snapshot === "string" && /^[0-9a-f-]{36}$/i.test(snapshot) ? snapshot : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Create your free account</h1>
      <p className="text-slate-600">
        Accounts are coming soon. With an account, your facts, audits and corrections will be saved so you can come back
        and re-audit later.
      </p>
      {snapshotId ? (
        <>
          <p className="text-slate-600">
            For now, you can continue without an account: confirm your facts, run a deep audit on one focus area and get
            your first evidence-backed correction.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/snapshot/${snapshotId}/facts`}>Continue without an account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/snapshot/${snapshotId}/results`}>Back to your snapshot</Link>
            </Button>
          </div>
        </>
      ) : (
        <Button asChild>
          <Link href="/">Run a free snapshot</Link>
        </Button>
      )}
    </div>
  );
}
