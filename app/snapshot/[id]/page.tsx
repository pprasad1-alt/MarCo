import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SnapshotProgress } from "@/components/marco/snapshot-progress";
import { JourneySteps } from "@/components/marco/journey-steps";
import { getSnapshotBundle } from "@/lib/store";

export const metadata: Metadata = { title: "Running your snapshot · MarCo" };

export default async function SnapshotProgressPage(props: PageProps<"/snapshot/[id]">) {
  const { id } = await props.params;
  const bundle = await getSnapshotBundle(id);
  if (!bundle?.progress || !bundle.brand) notFound();
  if (bundle.progress.status === "done") redirect(`/snapshot/${id}/results`);

  const { auditId, step, index, totalQuestions, status, error } = bundle.progress;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <JourneySteps current="Snapshot" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Running your free snapshot</h1>
        <p className="break-all text-sm text-slate-500">{bundle.brand.url}</p>
        <p className="text-slate-600">We ask one question at a time and save progress as we go. This usually takes under a minute.</p>
      </div>
      <SnapshotProgress initial={{ auditId, step, index, totalQuestions, status, error }} />
    </div>
  );
}
