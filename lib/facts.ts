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

// ---------------------------------------------------------------------------
// Fact review (the customer confirms, edits or rejects each fact)
// ---------------------------------------------------------------------------

export const FactDecision = z.object({
  id: z.string().min(1),
  decision: z.enum(["confirm", "reject", "skip"]),
  /** The (possibly edited) wording. Plain text only. */
  value: z.string().trim().min(1, "A fact can't be empty.").max(300, "Keep each fact under 300 characters."),
});
export const FactReview = z.object({ decisions: z.array(FactDecision).min(1) });
export type FactReview = z.infer<typeof FactReview>;

/**
 * Applies the customer's review to a brand's facts. Editing a fact's wording
 * creates a new version. Returns an error message instead of saving if the
 * review is incomplete.
 */
export function applyFactReview(
  facts: Fact[],
  review: FactReview,
  at: string,
): { ok: true; facts: Fact[] } | { ok: false; error: string } {
  const byId = new Map(review.decisions.map((d) => [d.id, d]));
  if (review.decisions.some((d) => !facts.some((f) => f.id === d.id))) {
    return { ok: false, error: "Some facts no longer exist. Reload the page and try again." };
  }
  if (!review.decisions.some((d) => d.decision === "confirm")) {
    return { ok: false, error: "Confirm at least one fact so MarCo has something to check AI answers against." };
  }
  const updated = facts.map((f): Fact => {
    const d = byId.get(f.id);
    if (!d) return f;
    const edited = d.value !== f.value;
    const base = edited ? { ...f, value: d.value, version: f.version + 1 } : f;
    if (d.decision === "confirm") return { ...base, confirmed: true, confirmedAt: at, rejected: false };
    if (d.decision === "reject") return { ...base, confirmed: false, confirmedAt: null, rejected: true };
    return { ...base, confirmed: false, confirmedAt: null, rejected: false };
  });
  return { ok: true, facts: updated };
}
