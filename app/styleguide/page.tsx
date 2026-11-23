import type { Metadata } from "next";
import { connection } from "next/server";
import { EvidenceQuote } from "@/components/marco/evidence-quote";
import { FindingBadge } from "@/components/marco/finding-badge";
import { MetricTile } from "@/components/marco/metric-tile";
import { ModeBanner } from "@/components/marco/mode-banner";
import { JourneySteps } from "@/components/marco/journey-steps";
import { Logo } from "@/components/marco/logo";
import { OutcomeBadge } from "@/components/marco/outcome-badge";
import { SampleNote } from "@/components/marco/sample-note";
import { StatusPill } from "@/components/marco/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FINDING_STYLES } from "@/lib/findings";
import { MODES, MODE_COPY, getMode } from "@/lib/mode";
import { ACTION_STATUSES, FINDING_KINDS } from "@/lib/types";

export const metadata: Metadata = { title: "Style guide · MarCo" };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function StyleguidePage() {
  await connection(); // show the mode at request time
  const current = getMode();

  return (
    <div className="space-y-14">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Style guide</h1>
        <p className="text-slate-600">
          Every shared MarCo component in one place. Sample content only. Current mode:{" "}
          <span className="font-medium text-slate-900">{current.label}</span>.
        </p>
        <p className="text-sm text-slate-500">{current.reason}</p>
      </header>

      <Section
        title="Mode banners"
        description="Shown at the top of every screen. The live one is at the very top of this page."
      >
        <div className="overflow-hidden rounded-xl border">
          {MODES.map((m) => (
            <ModeBanner key={m} mode={{ mode: m, ...MODE_COPY[m] }} className="last:border-b-0" />
          ))}
        </div>
      </Section>

      <Section
        title="Finding labels"
        description="Icon, text and color, the same everywhere. Before facts are confirmed, findings are labeled “potential”."
      >
        <Card>
          <CardContent className="divide-y">
            {FINDING_KINDS.map((kind) => (
              <div
                key={kind}
                className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="flex flex-wrap gap-2 sm:w-[26rem] sm:shrink-0">
                  <FindingBadge kind={kind} />
                  <FindingBadge kind={kind} potential />
                </div>
                <p className="text-sm text-slate-600">{FINDING_STYLES[kind].meaning}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </Section>

      <Section title="Evidence quote" description="The AI's exact words, its sources and why it matters.">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div>
                <FindingBadge kind="inaccurate" potential />
              </div>
              <CardTitle className="text-base">Pricing described incorrectly</CardTitle>
            </CardHeader>
            <CardContent>
              <EvidenceQuote
                quote="FlowOps offers a free plan for up to 10 users, with paid plans starting at $12 per user per month."
                attribution="Gemini, answering: “How much does FlowOps cost?”"
                sources={[{ url: "https://www.example.com/flowops-review", title: "FlowOps review (example.com)" }]}
                whyItMatters="Buyers comparing prices may rule you out, or expect a plan you don't offer."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <FindingBadge kind="visibility_gap" potential />
              </div>
              <CardTitle className="text-base">Not included in a tool roundup</CardTitle>
            </CardHeader>
            <CardContent>
              <EvidenceQuote
                quote="Popular project management tools for startups include Asana, ClickUp and Monday.com."
                attribution="Gemini, answering: “What are the best project management tools for startups?”"
                whyItMatters="Buyers asking this question never hear your name."
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Metric tiles" description="Separate metrics, counts shown with rates. No combined score.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricTile
            label="Unaided brand mention rate"
            count={3}
            total={10}
            explanation="Answers to buyer questions that mentioned you without being asked."
            howCalculated="Discovery and comparison answers that name your brand, divided by all discovery and comparison answers. These questions never mention your brand."
          />
          <MetricTile
            label="Competitor inclusion"
            count={9}
            total={10}
            explanation="Answers that named at least one of your competitors."
            howCalculated="Discovery and comparison answers naming at least one listed competitor, divided by all discovery and comparison answers."
          />
          <MetricTile
            label="Verified claim accuracy"
            count={0}
            total={0}
            explanation="Claims that match your confirmed facts."
            howCalculated="Accurate claims divided by all claims checked against confirmed facts."
            notApplicableReason="N/A until you confirm your facts."
          />
        </div>
      </Section>

      <Section
        title="Status pills"
        description="Where a corrective action stands. Only the customer can set Published."
      >
        <div className="flex flex-wrap gap-2">
          {ACTION_STATUSES.map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section
        title="Logo and journey"
        description="Placeholder logo until the real one arrives. The step indicator shows where the customer is."
      >
        <div className="space-y-6 rounded-xl border p-6">
          <Logo />
          <JourneySteps current="Deep audit" />
          <SampleNote>Sample results for FlowOps, a fictional company.</SampleNote>
        </div>
      </Section>

      <Section
        title="Action outcomes"
        description="What MarCo recommends for each issue. New content is only one of three valid outcomes."
      >
        <div className="flex flex-wrap gap-2">
          <OutcomeBadge outcome="correction" />
          <OutcomeBadge outcome="investigate" />
          <OutcomeBadge outcome="no_correction" />
        </div>
      </Section>

      <Section title="Buttons" description="One primary button per screen; everything else secondary.">
        <div className="flex flex-wrap gap-3">
          <Button>Run free snapshot</Button>
          <Button variant="outline">See all 10 answers</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="link" className="px-0">
            How MarCo works
          </Button>
          <Button disabled>Approve draft</Button>
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-2">
          <p className="text-3xl font-semibold tracking-tight">Page title, 30px semibold</p>
          <p className="text-xl font-semibold tracking-tight">Section heading, 20px semibold</p>
          <p className="text-base">Body text, 16px. Plain language, sentence case.</p>
          <p className="text-sm text-slate-500">Meta text, 14px slate-500</p>
          <p className="font-mono text-3xl font-semibold">3 of 10</p>
        </div>
      </Section>

      <Section title="Other building blocks" description="shadcn/ui components used across screens.">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
              <CardDescription>Asking AI buyer questions: question 4 of 10</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={40} aria-label="Snapshot progress" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tabs</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="findings">
                <TabsList>
                  <TabsTrigger value="findings">Findings</TabsTrigger>
                  <TabsTrigger value="answers">All answers</TabsTrigger>
                </TabsList>
                <TabsContent value="findings" className="pt-3 text-sm text-slate-600">
                  The top findings, ranked by priority.
                </TabsContent>
                <TabsContent value="answers" className="pt-3 text-sm text-slate-600">
                  Every AI answer, word for word.
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Text area and dialog</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="Edit the draft here…" aria-label="Draft text" />
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Open a dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Mark as published?</DialogTitle>
                    <DialogDescription>
                      Only do this after you have published the change yourself. MarCo never publishes for you.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button>Mark as published</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}
