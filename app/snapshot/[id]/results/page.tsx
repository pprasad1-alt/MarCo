import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleCheck, Info } from "lucide-react";
import { AnswersList } from "@/components/marco/answers-list";
import { FindingCard } from "@/components/marco/finding-card";
import { JourneySteps } from "@/components/marco/journey-steps";
import { SampleNote } from "@/components/marco/sample-note";
import { Scorecard } from "@/components/marco/scorecard";
import { Button } from "@/components/ui/button";
import { buildSnapshotResults } from "@/lib/results";
import { LocalDate } from "@/components/marco/local-date";
import { getSnapshotBundle } from "@/lib/store";

export const metadata: Metadata = { title: "Your free snapshot · MarCo" };

export default async function SnapshotResultsPage(props: PageProps<"/snapshot/[id]/results">) {
  const { id } = await props.params;
  const bundle = await getSnapshotBundle(id);
  if (!bundle?.brand) notFound();
  if (bundle.progress?.status !== "done") redirect(`/snapshot/${id}`);

  const { brand, runs } = bundle;
  const reviewed = Boolean(brand.factsReviewedAt);
  const results = buildSnapshotResults(bundle);
  // Label by the mode that actually produced these answers.
  const isMock = runs.some((r) => r.mode === "MOCK");

  return (
    <div className="space-y-12">
      <JourneySteps current="Snapshot" />
      <header className="space-y-3">
        <p className="text-sm font-medium text-indigo-600">Free snapshot</p>
        <h1 className="text-3xl font-semibold tracking-tight">How AI describes {brand.name}</h1>
        <p className="text-sm text-slate-500">
          Based on {runs.length} AI answers · <LocalDate iso={bundle.audit.createdAt} />
        </p>
        {isMock && (
          <SampleNote>
            Sample results for {brand.name}, a fictional company. You entered{" "}
            <span className="break-all">{brand.url}</span>; no real audit was run.
          </SampleNote>
        )}
        {reviewed ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900"
          >
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Findings updated based on your confirmed facts. A claim that contradicts a confirmed fact is now
              “Inaccurate”; a claim about a fact you rejected can no longer be checked. A missing mention is a gap, not
              an error.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <Info className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
            These findings are potential: they compare AI answers with facts read from your website, which you
            haven&apos;t confirmed yet. A missing mention is a gap, not an error.
          </p>
        )}
      </header>

      <section className="space-y-4" aria-labelledby="scorecard">
        <div className="space-y-1">
          <h2 id="scorecard" className="text-xl font-semibold tracking-tight">
            Scorecard
          </h2>
          <p className="text-sm text-slate-500">
            Separate measures, each shown as a count and a rate. There is no single overall score.
          </p>
        </div>
        <Scorecard metrics={results.scorecard} competitors={results.competitors} />
      </section>

      <section className="space-y-4" aria-labelledby="top-findings">
        <div className="space-y-1">
          <h2 id="top-findings" className="text-xl font-semibold tracking-tight">
            Top {results.topFindings.length || ""} {reviewed ? "findings" : "potential findings"}
          </h2>
          <p className="text-sm text-slate-500">
            The issues most likely to matter to buyers, with the AI&apos;s exact words.
          </p>
        </div>
        {results.topFindings.length > 0 ? (
          <div className="grid gap-4">
            {results.topFindings.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border p-6 text-slate-600">
            No potential issues showed up in this sample of answers. That&apos;s a good sign, but a sample of 10 answers
            can miss things; the full audit checks more.
          </p>
        )}
      </section>

      <AnswersList answers={results.answers} brandName={brand.name} />

      <section className="space-y-4 rounded-xl border bg-slate-50 p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Go from findings to fixes</h2>
          <p className="text-slate-600">
            Confirm your facts, run a deeper audit on one focus area, and get a specific, evidence-backed correction you
            can review and publish yourself.
          </p>
        </div>
        <Button asChild size="lg" className="h-auto w-full py-3 text-center whitespace-normal sm:w-auto">
          <Link href={`/signup?snapshot=${encodeURIComponent(id)}`}>
            Create a free account to see the full audit and get your first correction
          </Link>
        </Button>
      </section>
    </div>
  );
}
