import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Create your free account · MarCo" };

// Placeholder until accounts (Supabase) are added.
export default async function SignupPage(props: PageProps<"/signup">) {
  const { snapshot } = await props.searchParams;
  const snapshotId = typeof snapshot === "string" && /^[0-9a-f-]{36}$/i.test(snapshot) ? snapshot : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Create your free account</h1>
      <p className="text-slate-600">
        Accounts are coming soon. With an account you&apos;ll confirm your facts, run a deep audit on one focus area and
        get your first evidence-backed correction to review.
      </p>
      <Button asChild>
        <Link href={snapshotId ? `/snapshot/${snapshotId}/results` : "/"}>
          {snapshotId ? "Back to your snapshot" : "Run a free snapshot"}
        </Link>
      </Button>
    </div>
  );
}
