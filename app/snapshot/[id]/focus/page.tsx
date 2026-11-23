import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { FocusPicker } from "@/components/marco/focus-picker";
import { getMode } from "@/lib/mode";
import { MOCK_DEEP_AREAS } from "@/lib/mock";
import { buildSnapshotResults } from "@/lib/results";
import { getSnapshotBundle } from "@/lib/store";
import { FOCUS_AREAS } from "@/lib/types";

export const metadata: Metadata = { title: "Choose a focus area · MarCo" };

export default async function FocusPage(props: PageProps<"/snapshot/[id]/focus">) {
  await connection();
  const { id } = await props.params;
  const bundle = await getSnapshotBundle(id);
  if (!bundle?.brand || bundle.audit.type !== "snapshot") notFound();
  if (bundle.progress?.status !== "done") redirect(`/snapshot/${id}`);
  if (!bundle.brand.factsReviewedAt) redirect(`/snapshot/${id}/facts`);

  const isMock = (bundle.audit.mode ?? getMode().mode) === "MOCK";
  const findings = buildSnapshotResults(bundle).answers.flatMap((a) => a.findings.filter((f) => f.kind !== "accurate"));
  const options = FOCUS_AREAS.map((area) => {
    const available = !isMock || MOCK_DEEP_AREAS.includes(area);
    return {
      area,
      findings: findings.filter((f) => f.focusArea === area).length,
      available,
      unavailableReason: available ? undefined : "Not in the sample data. Available once Gemini is connected.",
    };
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">Step 2 of 2 · Full audit</p>
        <h1 className="text-3xl font-semibold tracking-tight">Choose a focus area</h1>
        <p className="text-slate-600">
          A deep audit looks closely at one area: 5 buyer questions, each asked 3 separate times so one unusual answer
          doesn&apos;t mislead you. Pick the area that matters most to your buyers right now.
        </p>
        <p className="text-sm text-slate-500">
          <Link href={`/snapshot/${id}/facts`} className="text-indigo-600 hover:underline">
            Review your facts again
          </Link>
        </p>
      </header>
      <FocusPicker snapshotId={id} options={options} />
    </div>
  );
}
