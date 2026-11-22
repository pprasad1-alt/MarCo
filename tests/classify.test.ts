import { describe, expect, it } from "vitest";
import { classifyAnswer, type AnswerAnalysis } from "@/lib/classify";
import { findingLabel } from "@/lib/findings";
import type { Fact } from "@/lib/types";

const fact = (id: string, value: string, confirmed: boolean): Fact => ({
  id,
  brandId: "b1",
  factType: "pricing",
  value,
  sourceUrl: "https://flowops.example.com/pricing",
  confirmed,
  version: 1,
  confirmedAt: confirmed ? "2026-11-22T00:00:00.000Z" : null,
});

const unconfirmed = [fact("free", "Free plan for up to 5 users", false), fact("team", "Team plan is $8", false)];
const confirmed = unconfirmed.map((f) => ({ ...f, confirmed: true, confirmedAt: "2026-11-22T00:00:00.000Z" }));

const run = (answer: string) => ({ id: "r1", answer });
const discovery = { type: "discovery" as const };
const factQ = { type: "fact_verification" as const };

describe("classification rules", () => {
  it("an omission is never labeled inaccurate (visibility gap)", () => {
    const out = classifyAnswer({
      run: run("Popular tools include Asana, ClickUp and Monday.com."),
      prompt: discovery,
      brandName: "FlowOps",
      facts: confirmed,
      analysis: { claims: [], relevantFactIds: [] },
    });
    expect(out.claims).toHaveLength(0);
    expect(out.gaps).toEqual([expect.objectContaining({ type: "visibility", expected: "FlowOps" })]);
  });

  it("an omission is never labeled inaccurate (coverage gap)", () => {
    const out = classifyAnswer({
      run: run("FlowOps has a Team plan."),
      prompt: factQ,
      brandName: "FlowOps",
      facts: confirmed,
      analysis: {
        claims: [{ excerpt: "FlowOps has a Team plan.", factId: "team", relation: "supports" }],
        relevantFactIds: ["free", "team"],
      },
    });
    expect(out.claims.every((c) => c.label !== "inaccurate")).toBe(true);
    expect(out.gaps).toEqual([expect.objectContaining({ type: "coverage", expectedFactId: "free" })]);
  });

  it("a brand mention means no visibility gap", () => {
    const out = classifyAnswer({
      run: run("Try Asana or FlowOps."),
      prompt: discovery,
      brandName: "FlowOps",
      facts: confirmed,
      analysis: { claims: [], relevantFactIds: [] },
    });
    expect(out.gaps).toHaveLength(0);
  });

  it("before facts are confirmed, every finding is potential", () => {
    const analysis: AnswerAnalysis = {
      claims: [
        { excerpt: "free for 10 users", factId: "free", relation: "contradicts" },
        { excerpt: "$8", factId: "team", relation: "supports" },
        { excerpt: "has AI summaries", factId: null, relation: "none" },
      ],
      relevantFactIds: ["free", "team", "missing-from-answer"],
    };
    const facts = [...unconfirmed, fact("missing-from-answer", "Time tracking", false)];
    const a = classifyAnswer({ run: run("Asana is good."), prompt: discovery, brandName: "FlowOps", facts, analysis });
    expect(a.claims.length + a.gaps.length).toBeGreaterThan(3);
    expect(a.claims.every((c) => c.potential)).toBe(true);
    expect(a.gaps.every((g) => g.potential)).toBe(true);
    // ...and the label the user sees says so.
    const inaccurate = a.claims.find((c) => c.label === "inaccurate")!;
    expect(findingLabel(inaccurate.label, inaccurate.potential)).toBe("Potential inaccuracy");
  });

  it("only a contradiction of a CONFIRMED fact is a (non-potential) inaccuracy", () => {
    const out = classifyAnswer({
      run: run("FlowOps is free for 10 users."),
      prompt: factQ,
      brandName: "FlowOps",
      facts: confirmed,
      analysis: { claims: [{ excerpt: "free for 10 users", factId: "free", relation: "contradicts" }], relevantFactIds: [] },
    });
    expect(out.claims[0]).toMatchObject({ label: "inaccurate", potential: false, matchedFactId: "free" });
  });

  it("a claim with no matching fact is unverifiable, not inaccurate", () => {
    const out = classifyAnswer({
      run: run("FlowOps has 5,000 Zapier apps."),
      prompt: factQ,
      brandName: "FlowOps",
      facts: confirmed,
      analysis: {
        claims: [
          { excerpt: "5,000 Zapier apps", factId: null, relation: "contradicts" },
          { excerpt: "unknown fact", factId: "does-not-exist", relation: "contradicts" },
        ],
        relevantFactIds: [],
      },
    });
    expect(out.claims.map((c) => c.label)).toEqual(["unverifiable", "unverifiable"]);
  });

  it("an answer with no citations is not labeled inaccurate", () => {
    // Citations are not an input to classification at all: the same answer
    // gets the same labels whether or not the AI cited sources.
    const analysis: AnswerAnalysis = {
      claims: [
        { excerpt: "FlowOps offers a free plan", factId: "free", relation: "supports" },
        { excerpt: "It has AI summaries", factId: null, relation: "none" },
      ],
      relevantFactIds: [],
    };
    const base = { prompt: factQ, brandName: "FlowOps", facts: confirmed, analysis };
    const noCitations = classifyAnswer({ ...base, run: { id: "r1", answer: "FlowOps offers a free plan.", rawCitations: [] } as never });
    const withCitations = classifyAnswer({
      ...base,
      run: { id: "r1", answer: "FlowOps offers a free plan.", rawCitations: [{ url: "https://x.example" }] } as never,
    });
    expect(noCitations.claims.map((c) => c.label)).toEqual(["accurate", "unverifiable"]);
    expect(noCitations.claims.map((c) => c.label)).toEqual(withCitations.claims.map((c) => c.label));
    expect(noCitations.claims.some((c) => c.label === "inaccurate")).toBe(false);
  });
});
