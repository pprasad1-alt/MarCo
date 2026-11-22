/**
 * Mock-mode fixture data (fixtures/flowops.json), validated on load.
 * Only used when lib/mode.ts reports MOCK. Real code paths return the same types.
 */
import { z } from "zod";
import raw from "@/fixtures/flowops.json";
import { AnswerAnalysis } from "@/lib/classify";
import { ExtractedFact, ExtractedPage, RawCitation } from "@/lib/types";

const Fixture = z.object({
  brand: z.object({
    name: z.string(),
    url: z.url(),
    category: z.string(),
    competitors: z.array(z.string()),
  }),
  pages: z.array(ExtractedPage),
  facts: z.array(ExtractedFact.extend({ id: z.string() })),
  answers: z.record(
    z.string(),
    z.object({
      answer: z.string(),
      citations: z.array(RawCitation),
      analysis: AnswerAnalysis,
    }),
  ),
});
export type Fixture = z.infer<typeof Fixture>;

export const MOCK_FIXTURE: Fixture = Fixture.parse(raw);

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
