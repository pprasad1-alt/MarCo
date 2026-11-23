/**
 * Mock-mode fixture data (fixtures/flowops.json), validated on load.
 * Only used when lib/mode.ts reports MOCK. Real code paths return the same types.
 */
import { z } from "zod";
import raw from "@/fixtures/flowops.json";
import { AnswerAnalysis } from "@/lib/classify";
import { DEEP_PROMPT_IDS } from "@/lib/prompts";
import { ContentCheckResult, ExtractedFact, ExtractedPage, FOCUS_AREAS, RawCitation, type FocusArea } from "@/lib/types";

const MockAnswer = z.object({
  answer: z.string(),
  citations: z.array(RawCitation),
  analysis: AnswerAnalysis,
});
export type MockAnswer = z.infer<typeof MockAnswer>;

const Fixture = z.object({
  brand: z.object({
    name: z.string(),
    url: z.url(),
    category: z.string(),
    competitors: z.array(z.string()),
  }),
  pages: z.array(ExtractedPage),
  facts: z.array(ExtractedFact.extend({ id: z.string() })),
  /** Mock result of "does the website already state this fact clearly?", by fact key. Default: stated clearly. */
  contentChecks: z.record(z.string(), z.object({ result: ContentCheckResult, note: z.string() })),
  /** One answer, or several that runs 1, 2, 3 use in turn (AI answers vary between runs). */
  answers: z.record(z.string(), z.union([MockAnswer, z.array(MockAnswer).min(1)])),
  /** Answers used by re-audits; questions not listed reuse `answers`. */
  reauditAnswers: z.record(z.string(), z.union([MockAnswer, z.array(MockAnswer).min(1)])).default({}),
});
export type Fixture = z.infer<typeof Fixture>;

export const MOCK_FIXTURE: Fixture = Fixture.parse(raw);

/** The mock answer for a question on a given run (1-based). Re-audits may use different answers. */
export function mockAnswerFor(promptId: string, runNumber = 1, reaudit = false): MockAnswer | undefined {
  const entry = (reaudit && MOCK_FIXTURE.reauditAnswers[promptId]) || MOCK_FIXTURE.answers[promptId];
  if (!entry) return undefined;
  const list = Array.isArray(entry) ? entry : [entry];
  return list[(runNumber - 1) % list.length];
}

/** Focus areas with complete mock data for a deep audit. */
export const MOCK_DEEP_AREAS: FocusArea[] = FOCUS_AREAS.filter((area) =>
  DEEP_PROMPT_IDS[area].every((id) => MOCK_FIXTURE.answers[id] !== undefined),
);

/**
 * Demo helper for the error state: in mock mode, a URL on this host fails the
 * first time question 4 is asked, so "Try again" can be shown working.
 */
export const MOCK_ERROR_HOST = "mock-error.example.com";

/** Simulated wait so the progress screen is visible in mock mode (0 in tests). */
export function mockDelay(ms = 450): Promise<void> {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}
