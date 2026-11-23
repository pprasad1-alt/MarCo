"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Circle, CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { STEP_LABELS, STEPS_FOR } from "@/lib/steps";
import type { SnapshotStatus } from "@/lib/audit";
import type { AuditType } from "@/lib/types";

type Props = { initial: SnapshotStatus; auditType?: AuditType };

/** Overall progress: each answer asked or classified counts as one unit; other steps count as one. */
function percent(s: SnapshotStatus, steps: string[]): number {
  const n = s.totalQuestions;
  const size = (step: string) => (step === "asking" || step === "classifying" ? n : 1);
  const total = steps.reduce((sum, st) => sum + size(st), 0);
  if (s.step === "done") return 100;
  const before = steps.slice(0, Math.max(0, steps.indexOf(s.step))).reduce((sum, st) => sum + size(st), 0);
  const within = s.step === "asking" || s.step === "classifying" ? s.index : 0;
  return Math.round(((before + within) / total) * 100);
}

export function SnapshotProgress({ initial, auditType = "snapshot" }: Props) {
  const steps = STEPS_FOR[auditType];
  const resultsUrl = auditType === "snapshot" ? `/snapshot/${initial.auditId}/results` : `/audit/${initial.auditId}/report`;
  const router = useRouter();
  const [status, setStatus] = useState<SnapshotStatus>(initial);
  const [fatal, setFatal] = useState<string | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);

  const run = useCallback(async () => {
    if (running.current) return; // one loop at a time
    running.current = true;
    try {
      while (mounted.current) {
        const res = await fetch(`/api/audits/${initial.auditId}/step`, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 404) {
            setFatal(body.error ?? "We couldn't find that snapshot.");
          } else {
            setStatus((s) => ({ ...s, status: "failed", error: body.error ?? "Something went wrong. Please try again." }));
          }
          break;
        }
        const next = body as SnapshotStatus;
        if (!mounted.current) break;
        setStatus(next);
        if (next.status === "done") {
          router.replace(resultsUrl);
          break;
        }
        if (next.status === "failed") break;
      }
    } catch {
      setStatus((s) => ({
        ...s,
        status: "failed",
        error: "We lost the connection to MarCo. Your progress is saved. Check your internet and try again.",
      }));
    } finally {
      running.current = false;
    }
  }, [initial.auditId, router, resultsUrl]);

  useEffect(() => {
    mounted.current = true;
    // Start on the next tick; the cleanup cancels it if React re-mounts (dev mode).
    const timer = setTimeout(() => {
      if (initial.status === "running") void run();
      if (initial.status === "done") router.replace(resultsUrl);
    }, 0);
    return () => {
      clearTimeout(timer);
      mounted.current = false;
    };
  }, [initial.status, run, router, resultsUrl]);

  function tryAgain() {
    setStatus((s) => ({ ...s, status: "running", error: null }));
    void run();
  }

  if (fatal) {
    return (
      <div className="space-y-4 rounded-xl border p-6">
        <p className="flex items-start gap-2 text-slate-800">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
          {fatal}
        </p>
        <Button asChild>
          <Link href="/">Start a new snapshot</Link>
        </Button>
      </div>
    );
  }

  const currentIdx = status.step === "done" ? steps.length : steps.indexOf(status.step as (typeof steps)[number]);
  const i = Math.min(status.index, status.totalQuestions - 1);
  const runsPerQuestion = auditType === "snapshot" ? 1 : 3;
  const counter =
    status.step === "asking"
      ? runsPerQuestion === 1
        ? `Question ${i + 1} of ${status.totalQuestions}`
        : `Question ${Math.floor(i / runsPerQuestion) + 1} of ${status.totalQuestions / runsPerQuestion} · run ${(i % runsPerQuestion) + 1} of ${runsPerQuestion}`
      : status.step === "classifying"
        ? `Answer ${i + 1} of ${status.totalQuestions}`
        : null;
  const pct = percent(status, steps);
  const failed = status.status === "failed";

  return (
    <div className="space-y-6 rounded-xl border p-6">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-slate-700">{pct}% complete</p>
          {counter && <p className="font-mono text-sm text-slate-500">{counter}</p>}
        </div>
        <Progress value={pct} aria-label="Snapshot progress" />
      </div>

      <ol className="space-y-3" aria-live="polite">
        {steps.map((step, n) => {
          const state = n < currentIdx ? "done" : n === currentIdx ? (failed ? "failed" : "current") : "pending";
          return (
            <li key={step} className="flex items-center gap-3" aria-current={state === "current" ? "step" : undefined}>
              {state === "done" && <CircleCheck className="size-5 shrink-0 text-green-700" aria-hidden="true" />}
              {state === "current" && <Loader2 className="size-5 shrink-0 animate-spin text-indigo-600" aria-hidden="true" />}
              {state === "failed" && <TriangleAlert className="size-5 shrink-0 text-red-600" aria-hidden="true" />}
              {state === "pending" && <Circle className="size-5 shrink-0 text-slate-300" aria-hidden="true" />}
              <span className={state === "pending" ? "text-slate-400" : "text-slate-900"}>
                {STEP_LABELS[step]}
                {step === status.step && counter && <span className="text-slate-500"> · {counter}</span>}
              </span>
              <span className="sr-only">
                {state === "done" ? "(done)" : state === "current" ? "(in progress)" : state === "failed" ? "(stopped)" : "(not started)"}
              </span>
            </li>
          );
        })}
      </ol>

      {failed && (
        <div role="alert" className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="flex items-start gap-2 text-sm text-red-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {status.error ?? "Something went wrong. Your progress is saved."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={tryAgain}>Try again</Button>
            <Button variant="outline" asChild>
              <Link href="/">Start over</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
