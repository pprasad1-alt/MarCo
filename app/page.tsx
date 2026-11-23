import { FileSearch, MessagesSquare, ShieldCheck, FlaskConical } from "lucide-react";
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

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="max-w-2xl space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            See how AI represents your brand. Know what to improve.
          </h1>
          <p className="text-base text-slate-600">
            MarCo asks AI assistants the questions your buyers ask, then shows what they get right, what they get wrong
            and what they leave out.
          </p>
        </div>

        <UrlForm />

        <p className="text-sm text-slate-600">
          Not ready to try your own site?{" "}
          {/* Plain link (no prefetch): opening it may start a sample run. */}
          <a href="/sample" className="font-medium text-indigo-600 hover:underline">
            See a sample report
          </a>{" "}
          for FlowOps, a fictional company.
        </p>

        <Suspense>
          <MockOnly>
            <p className="flex items-start gap-1.5 text-sm text-slate-500">
              <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Mock mode: any address shows sample results for FlowOps, a fictional company.
            </p>
          </MockOnly>
        </Suspense>
      </section>

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
