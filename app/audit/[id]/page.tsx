import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SnapshotProgress } from "@/components/marco/snapshot-progress";
import { getSnapshotBundle } from "@/lib/store";
import { FOCUS_AREA_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Running your deep audit · MarCo" };

export default async function AuditProgressPage(props: PageProps<"/audit/[id]">) {
  const { id } = await props.params;
  const bundle = await getSnapshotBundle(id);
  if (!bundle?.progress || !bundle.brand) notFound();
  if (bundle.audit.type === "snapshot") redirect(`/snapshot/${id}`);
  if (bundle.progress.status === "done") redirect(`/audit/${id}/report`);

  const { auditId, step, index, totalQuestions, status, error } = bundle.progress;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Running your deep audit</h1>
        <p className="text-sm text-slate-500">
          {bundle.brand.name} · {bundle.audit.focusArea ? FOCUS_AREA_LABELS[bundle.audit.focusArea] : ""}
        </p>
        <p className="text-slate-600">
          Each question is asked 3 separate times, with a fresh answer every time. We save progress as we go.
        </p>
      </div>
      <SnapshotProgress auditType={bundle.audit.type} initial={{ auditId, step, index, totalQuestions, status, error }} />
    </div>
  );
}
