import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FactReview } from "@/components/marco/fact-review";
import { getSnapshotBundle } from "@/lib/store";

export const metadata: Metadata = { title: "Confirm your facts · MarCo" };

export default async function FactsPage(props: PageProps<"/snapshot/[id]/facts">) {
  const { id } = await props.params;
  const bundle = await getSnapshotBundle(id);
  if (!bundle?.brand || bundle.audit.type !== "snapshot") notFound();
  if (bundle.progress?.status !== "done") redirect(`/snapshot/${id}`);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">Step 1 of 2 · Full audit</p>
        <h1 className="text-3xl font-semibold tracking-tight">Confirm your facts</h1>
        <p className="text-slate-600">
          These are the facts MarCo read on your website. Confirm the ones that are right, fix any that are worded badly,
          and reject anything wrong. MarCo only calls an AI answer <em>inaccurate</em> when it contradicts a fact you
          confirmed.
        </p>
      </header>
      <FactReview brandId={bundle.brand.id} snapshotId={id} facts={bundle.facts} />
    </div>
  );
}
