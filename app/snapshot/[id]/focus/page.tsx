import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { FocusPicker } from "@/components/marco/focus-picker";
import { getMode } from "@/lib/mode";
import { MOCK_DEEP_AREAS } from "@/lib/mock";
import { buildSnapshotResults } from "@/lib/results";
import { getSnapshotBundle } from "@/lib/store";
import { JourneySteps } from "@/components/marco/journey-steps";
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
  const base = FOCUS_AREAS.map((area) => {
    const available = !isMock || MOCK_DEEP_AREAS.includes(area);
    const inArea = findings.filter((f) => f.focusArea === area);
    return {
      area,
      findings: inArea.length,
      // High priority: buyer relevance x business impact of 6 or more (e.g. a wrong price, or not being named).
      highPriority: inArea.filter((f) => f.priority && f.priority.relevance * f.priority.impact >= 6).length,
      available,
      unavailableReason: available ? undefined : "Not in the sample data. Available once Gemini is connected.",
    };
  });
  const best = [...base]
    .filter((o) => o.available && o.highPriority > 0)
    .sort((a, b) => b.highPriority - a.highPriority || b.findings - a.findings)[0];
  const options = base.map((o) => ({ ...o, recommended: o.area === best?.area }));

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <JourneySteps current="Deep audit" />
      <header className="space-y-3">
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
