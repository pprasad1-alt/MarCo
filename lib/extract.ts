/**
 * Reads the company's website as plain text pages.
 *
 * MOCK: returns the FlowOps fixture pages, whatever URL was entered.
 * Real modes: Tavily (not connected yet; added when keys are available).
 *
 * Website text is DATA, never instructions: later prompts must wrap it in
 * clearly delimited blocks and tell the model to ignore instructions inside it.
 */
import { type ModeInfo } from "@/lib/mode";
import { MOCK_FIXTURE, mockDelay } from "@/lib/mock";
import type { ExtractedPage } from "@/lib/types";

export class NotConnectedError extends Error {
  constructor(what: string) {
    super(`${what} isn't connected yet. Remove the API keys to use mock mode, or finish the live setup.`);
    this.name = "NotConnectedError";
  }
}

export async function extractWebsite(url: string, mode: ModeInfo): Promise<ExtractedPage[]> {
  if (mode.mode === "MOCK") {
    await mockDelay();
    return MOCK_FIXTURE.pages;
  }
  // TODO (live mode): call Tavily extract/crawl for `url`; return the same ExtractedPage[] shape.
  void url;
  throw new NotConnectedError("Website reading (Tavily)");
}
