import { describe, expect, it } from "vitest";
import { checkDraftClaims, factSentence, sentenceMatchesFact, splitSentences } from "@/lib/drafts";
import { MOCK_FIXTURE } from "@/lib/mock";
import { canApproveDraft, type Fact } from "@/lib/types";

const facts: Fact[] = MOCK_FIXTURE.facts.map((f) => ({
  id: f.id,
  brandId: "b",
  factType: f.factType,
  value: f.value,
  sourceUrl: f.sourceUrl,
  confirmed: true,
  version: 1,
  confirmedAt: "2026-11-23T00:00:00.000Z",
}));

describe("draft claim checks", () => {
  it("turns every fixture fact into a sentence that checks out against that fact", () => {
    for (const f of facts) {
      const s = factSentence("FlowOps", f);
      expect(sentenceMatchesFact(s, f), s).toBe(true);
      expect(checkDraftClaims(s, facts)[0].supported, s).toBe(true);
    }
  });

  it("writes grammatical sentences from facts", () => {
    const byKey = Object.fromEntries(MOCK_FIXTURE.facts.map((f) => [f.id, f]));
    expect(factSentence("FlowOps", byKey["f-usecase-size"])).toBe("FlowOps is built for startup teams of 5 to 50 people.");
    expect(factSentence("FlowOps", byKey["f-customers"])).toBe("FlowOps is used by more than 1,200 startups.");
    expect(factSentence("FlowOps", byKey["f-company-founded"])).toBe("FlowOps was founded in 2019 in Austin, Texas.");
    expect(factSentence("FlowOps", byKey["f-pricing-free"])).toBe("FlowOps has a free plan for up to 5 users.");
    expect(factSentence("FlowOps", byKey["f-pricing-team"])).toBe("FlowOps's Team plan costs $8 per user per month, billed annually.");
    expect(factSentence("FlowOps", byKey["f-integrations"])).toBe("FlowOps integrates with Slack, GitHub, Google Drive and Figma.");
    expect(factSentence("FlowOps", byKey["f-features-time"])).toBe("FlowOps offers built-in time tracking on every task.");
  });

  it("splits sentences without breaking on domain names or prices", () => {
    expect(splitSentences("Compare us with Monday.com today. Plans cost $8.50 per user!\nNew line")).toEqual([
      "Compare us with Monday.com today.",
      "Plans cost $8.50 per user!",
      "New line",
    ]);
  });

  it("blocks approval when a sentence isn't backed by a confirmed fact or source", () => {
    const checks = checkDraftClaims("FlowOps is built for startup teams of 5 to 50 people. FlowOps is the #1 tool for everyone.", facts);
    expect(checks.map((c) => c.supported)).toEqual([true, false]);
    expect(canApproveDraft({ claimChecks: checks })).toBe(false);
  });

  it("rejects a sentence whose numbers don't match the fact", () => {
    expect(checkDraftClaims("FlowOps has a free plan for up to 10 users.", facts)[0].supported).toBe(false);
  });

  it("ignores unconfirmed and rejected facts", () => {
    const unconfirmed = facts.map((f) => ({ ...f, confirmed: false }));
    expect(checkDraftClaims("FlowOps is used by more than 1,200 startups.", unconfirmed)[0].supported).toBe(false);
    const rejected = facts.map((f) => ({ ...f, rejected: true }));
    expect(checkDraftClaims("FlowOps is used by more than 1,200 startups.", rejected)[0].supported).toBe(false);
  });

  it("accepts a manual link to a confirmed fact or an http(s) source, and nothing else", () => {
    const text = "Teams love how simple it is.";
    expect(checkDraftClaims(text, facts, [{ claimText: text, sourceUrl: "https://g2.example.com/flowops" }])[0].supported).toBe(true);
    expect(checkDraftClaims(text, facts, [{ claimText: text, factId: facts[0].id }])[0].supported).toBe(true);
    expect(checkDraftClaims(text, facts, [{ claimText: text, sourceUrl: "javascript:alert(1)" }])[0].supported).toBe(false);
    expect(checkDraftClaims(text, facts, [{ claimText: text, factId: "not-a-fact" }])[0].supported).toBe(false);
  });
});
