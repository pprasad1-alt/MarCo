"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Circle, CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { STEP_LABELS, VISIBLE_STEPS } from "@/lib/steps";
import type { SnapshotStatus } from "@/lib/audit";

type Props = { initial: SnapshotStatus };

/** Overall progress, counting each question and each classification as one unit. */
function percent(s: SnapshotStatus): number {
  const n = s.totalQuestions;
  const total = 2 + n * 2;
  const done =
    s.step === "reading" ? 0 : s.step === "facts" ? 1 : s.step === "asking" ? 2 + s.index : s.step === "classifying" ? 2 + n + s.index : total;
  return Math.round((done / total) * 100);
}

export function SnapshotProgress({ initial }: Props) {
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
        const res = await fetch(`/api/snapshot/${initial.auditId}/step`, { method: "POST" });
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
          router.replace(`/snapshot/${initial.auditId}/results`);
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
  }, [initial.auditId, router]);

  useEffect(() => {
    mounted.current = true;
    // Start on the next tick; the cleanup cancels it if React re-mounts (dev mode).
    const timer = setTimeout(() => {
      if (initial.status === "running") void run();
      if (initial.status === "done") router.replace(`/snapshot/${initial.auditId}/results`);
    }, 0);
    return () => {
      clearTimeout(timer);
      mounted.current = false;
    };
  }, [initial.status, initial.auditId, run, router]);

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

  const currentIdx = status.step === "done" ? VISIBLE_STEPS.length : VISIBLE_STEPS.indexOf(status.step);
  const counter =
    status.step === "asking"
      ? `Question ${Math.min(status.index + 1, status.totalQuestions)} of ${status.totalQuestions}`
      : status.step === "classifying"
        ? `Answer ${Math.min(status.index + 1, status.totalQuestions)} of ${status.totalQuestions}`
        : null;
  const failed = status.status === "failed";

  return (
    <div className="space-y-6 rounded-xl border p-6">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-slate-700">{percent(status)}% complete</p>
          {counter && <p className="font-mono text-sm text-slate-500">{counter}</p>}
        </div>
        <Progress value={percent(status)} aria-label="Snapshot progress" />
      </div>

      <ol className="space-y-3" aria-live="polite">
        {VISIBLE_STEPS.map((step, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? (failed ? "failed" : "current") : "pending";
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
