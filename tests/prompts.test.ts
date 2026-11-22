import { describe, expect, it } from "vitest";
import { MOCK_FIXTURE } from "@/lib/mock";
import { fillPrompt, getSnapshotPrompts, mentionsBrand, PROMPT_LIBRARY, PromptError } from "@/lib/prompts";

const BRANDS = [
  { name: MOCK_FIXTURE.brand.name, category: MOCK_FIXTURE.brand.category, competitors: MOCK_FIXTURE.brand.competitors },
  { name: "Linear", category: "issue tracking software", competitors: ["Jira", "Shortcut"] },
  { name: "Acme Analytics", category: "product analytics software", competitors: ["Mixpanel", "Amplitude"] },
];

describe("prompt library", () => {
  it("has 10 snapshot questions covering all six focus areas, with both question types", () => {
    const prompts = getSnapshotPrompts();
    expect(prompts).toHaveLength(10);
    expect(new Set(prompts.map((p) => p.focusArea)).size).toBe(6);
    expect(prompts.some((p) => p.type === "discovery")).toBe(true);
    expect(prompts.some((p) => p.type === "fact_verification")).toBe(true);
  });

  it("discovery question templates never use the {brand} placeholder", () => {
    for (const p of PROMPT_LIBRARY.filter((p) => p.type === "discovery")) {
      expect(p.questionTemplate).not.toContain("{brand}");
    }
  });

  it.each(BRANDS)("filled discovery questions never contain the brand name ($name)", (brand) => {
    for (const p of getSnapshotPrompts().filter((p) => p.type === "discovery")) {
      const text = fillPrompt(p, brand);
      expect(mentionsBrand(text, brand.name)).toBe(false);
      expect(text.toLowerCase()).not.toContain(brand.name.toLowerCase());
      expect(text).not.toMatch(/\{\w+\}/); // every placeholder filled
    }
  });

  it("refuses to build a discovery question that would name the brand", () => {
    const discovery = getSnapshotPrompts().find((p) => p.type === "discovery")!;
    expect(() =>
      fillPrompt(discovery, { name: "Flow", category: "Flow project management software", competitors: [] }),
    ).toThrow(PromptError);
  });

  it("fact-verification questions do name the brand", () => {
    for (const p of getSnapshotPrompts().filter((p) => p.type === "fact_verification")) {
      expect(fillPrompt(p, BRANDS[0])).toContain("FlowOps");
    }
  });

  it("every snapshot question has mock data", () => {
    for (const p of getSnapshotPrompts()) expect(MOCK_FIXTURE.answers[p.id]).toBeDefined();
  });
});
