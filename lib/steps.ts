import type { AuditType, SnapshotStep } from "@/lib/types";

type VisibleStep = Exclude<SnapshotStep, "done">;

/** Plain-language step names for the progress screen. */
export const STEP_LABELS: Record<VisibleStep, string> = {
  reading: "Reading your website",
  facts: "Extracting facts",
  asking: "Asking AI buyer questions",
  classifying: "Classifying answers",
  diagnosing: "Working out what to fix",
};

/** The steps each audit type goes through, in order. */
export const STEPS_FOR: Record<AuditType, VisibleStep[]> = {
  snapshot: ["reading", "facts", "asking", "classifying"],
  deep: ["asking", "classifying", "diagnosing"],
  re_audit: ["asking", "classifying", "diagnosing"],
};

/** Kept for the snapshot screen. */
export const VISIBLE_STEPS = STEPS_FOR.snapshot;
