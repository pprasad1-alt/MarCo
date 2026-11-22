import type { SnapshotStep } from "@/lib/types";

/** Plain-language step names for the progress screen, in order. */
export const STEP_LABELS: Record<Exclude<SnapshotStep, "done">, string> = {
  reading: "Reading your website",
  facts: "Extracting facts",
  asking: "Asking AI buyer questions",
  classifying: "Classifying answers",
};

export const VISIBLE_STEPS = Object.keys(STEP_LABELS) as Exclude<SnapshotStep, "done">[];
