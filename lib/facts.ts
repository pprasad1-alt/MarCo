/**
 * Fact extraction: website pages -> structured facts (fact type, value, source URL).
 *
 * MOCK: returns the FlowOps fixture facts.
 * Real modes: Gemini returns JSON; it is validated with zod and retried once.
 *
 * Extracted facts start UNCONFIRMED. Until the customer confirms them, every
 * finding that relies on them is labeled "potential".
 */
import { z } from "zod";
import { NotConnectedError } from "@/lib/extract";
import { type ModeInfo } from "@/lib/mode";
import { MOCK_FIXTURE, mockDelay } from "@/lib/mock";
import { ExtractedFact, type ExtractedPage, type Fact } from "@/lib/types";

export const ExtractedFactList = z.object({ facts: z.array(ExtractedFact) });

/**
 * Validates a model's JSON output; calls `generate` again once if it fails.
 * Never fills in or guesses missing data: a second failure throws.
 */
export async function parseWithRetry<T>(schema: z.ZodType<T>, generate: () => Promise<string>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return schema.parse(JSON.parse(await generate()));
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error("The AI returned data in an unexpected format twice.", { cause: lastError });
}

type ExtractedWithKey = ExtractedFact & { key: string };

/** Returns facts as extracted (no ids yet). `key` is a stable reference used by mock analyses. */
export async function extractFacts(pages: ExtractedPage[], mode: ModeInfo): Promise<ExtractedWithKey[]> {
  if (mode.mode === "MOCK") {
    await mockDelay();
    return MOCK_FIXTURE.facts.map(({ id, ...f }) => ({ ...f, key: id }));
  }
  // TODO (live mode): Gemini structured output -> parseWithRetry(ExtractedFactList, ...)
  void pages;
  throw new NotConnectedError("Fact extraction (Gemini)");
}

/** Turns extracted facts into stored, unconfirmed Fact records for a brand. */
export function toUnconfirmedFacts(brandId: string, extracted: ExtractedWithKey[]): Fact[] {
  return extracted.map((f) => ({
    id: `${brandId}-${f.key}`,
    brandId,
    factType: f.factType,
    value: f.value,
    sourceUrl: f.sourceUrl,
    confirmed: false,
    version: 1,
    confirmedAt: null,
  }));
}
