import { ArrowRight, FileSearch, FlaskConical, MessagesSquare, ShieldCheck } from "lucide-react";
import { FindingBadge } from "@/components/marco/finding-badge";
import { OutcomeBadge } from "@/components/marco/outcome-badge";
import { UrlForm } from "@/components/marco/url-form";
import { Suspense } from "react";
import { MockOnly } from "@/components/marco/live-mode";

const STEPS = [
  {
    icon: FileSearch,
    title: "We read your website",
    body: "MarCo pulls the key facts about your product from your public pages.",
  },
  {
    icon: MessagesSquare,
    title: "We ask AI your buyers' questions",
    body: "Ten questions a buyer might ask Gemini, from “best tools for startups” to “how much does it cost?”",
  },
  {
    icon: ShieldCheck,
    title: "You see what to improve",
    body: "Each finding shows the AI's exact words, its sources and why it matters.",
  },
];

/** A static illustration of one finding, so visitors see what MarCo produces before they start. */
function FindingPreview() {
  return (
    <figure aria-label="Example finding" className="rounded-2xl border bg-slate-50 p-3 sm:p-4">
      <div className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">Example finding</span>
          <span className="text-xs text-slate-500">Fictional company</span>
        </div>
        <FindingBadge kind="inaccurate" />
        <p className="font-semibold text-slate-900">AI says FlowOps is for enterprise IT teams</p>
        <blockquote className="rounded-lg border-l-4 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          “FlowOps is mainly used by enterprise IT teams that manage large project portfolios.”
        </blockquote>
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-800">Your confirmed fact:</span> built for startup teams of 5 to 50
          people.
          <span className="block text-slate-500">Seen in 4 of 15 AI answers.</span>
        </p>
        <div className="space-y-2 border-t pt-3">
          <OutcomeBadge outcome="correction" />
          <p className="flex items-start gap-1.5 text-sm text-slate-700">
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden="true" />
            Add a clear “who it&apos;s for” line to your homepage. Draft included, ready for your review.
          </p>
        </div>
      </div>
    </figure>
  );
}

export default function Home() {
  return (
    <div className="space-y-14">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <section className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-indigo-600">AI brand visibility for B2B SaaS</p>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              See how AI represents your brand. Know what to improve.
            </h1>
            <p className="text-base text-slate-600">
              MarCo asks AI assistants the questions your buyers ask, then shows what they get right, what they get
              wrong and what they leave out.
            </p>
          </div>

          <UrlForm />

          <p className="text-sm text-slate-600">
            Not ready to try your own site? {/* Plain link (no prefetch): opening it may start a sample run. */}
            <a href="/sample" className="font-medium text-indigo-600 hover:underline">
              See a sample report
            </a>{" "}
            for FlowOps, a fictional company.
          </p>

          <Suspense>
            <MockOnly>
              <p className="flex items-start gap-1.5 text-sm text-slate-500">
                <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Mock mode: any address you enter shows the same sample data.
              </p>
            </MockOnly>
          </Suspense>
        </section>
        <FindingPreview />
      </div>

      <section className="space-y-4" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="space-y-2 rounded-xl border p-6">
              <div className="flex items-center gap-2 text-indigo-600">
                <Icon className="size-5" aria-hidden="true" />
                <span className="text-sm font-medium text-slate-500">Step {i + 1}</span>
              </div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="border-t pt-6 text-sm text-slate-500">
        AI services process public website content. Results are samples, and improvements are not guaranteed.
      </p>
    </div>
  );
}
