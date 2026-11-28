import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DraftEditor } from "@/components/marco/draft-editor";
import { JourneySteps } from "@/components/marco/journey-steps";
import { SampleNote } from "@/components/marco/sample-note";
import { getActionBundle } from "@/lib/store";

export const metadata: Metadata = { title: "Draft editor · MarCo" };

export default async function DraftPage(props: PageProps<"/action/[id]/draft">) {
  const { id } = await props.params;
  const data = await getActionBundle(id);
  if (!data?.bundle.brand) notFound();
  const { action, issue, bundle, latestDraft } = data;
  // Only corrections have drafts; everything else goes back to its action card.
  if (action.outcome !== "correction" || !latestDraft) redirect(`/action/${id}`);
  const isMock = bundle.runs.some((r) => r.mode === "MOCK");

  return (
    <div className="space-y-6">
      <JourneySteps current="Fix" />
      <Link href={`/action/${id}`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to the action card
      </Link>
      <header className="space-y-2">
        <p className="text-sm font-medium text-indigo-600">Draft editor</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Draft for{" "}
          {action.draftDestination
            ? `your ${action.draftDestination.charAt(0).toLowerCase()}${action.draftDestination.slice(1)}`
            : action.destination}
        </h1>
        {action.draftDestination && action.draftDestination !== action.destination && (
          <p className="text-sm text-slate-500">Full recommendation: {action.destination}</p>
        )}
        <p className="text-slate-600">Fixes: {issue.observedIssue}</p>
        {isMock && <SampleNote>Sample data for {bundle.brand!.name}, a fictional company.</SampleNote>}
      </header>
      <DraftEditor
        actionId={action.id}
        initialAction={action}
        initialDraft={latestDraft}
        facts={bundle.facts}
        brandName={bundle.brand!.name}
      />
    </div>
  );
}
