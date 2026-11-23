import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyActionOp } from "@/lib/actions";
import { runSnapshotToEnd, startDeepAudit, startSnapshot } from "@/lib/audit";
import { applyFactReview, type FactReview } from "@/lib/facts";
import { resolveMode } from "@/lib/mode";
import { MOCK_DEEP_AREAS } from "@/lib/mock";
import { getSnapshotBundle, updateStore } from "@/lib/store";
import type { FocusArea } from "@/lib/types";

const MOCK = resolveMode({});
let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "marco-deep-"));
  process.env.MARCO_DATA_DIR = dir;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function snapshot() {
  const s = await startSnapshot("https://flowops.com", MOCK);
  if (!s.ok) throw new Error(s.error);
  await runSnapshotToEnd(s.auditId, MOCK);
  return s.auditId;
}

/** Simulates the fact review screen. `decide` picks a decision per fact key. */
async function review(snapshotId: string, decide: (key: string) => FactReview["decisions"][number]["decision"] = () => "confirm") {
  const b = (await getSnapshotBundle(snapshotId))!;
  const decisions = b.facts.map((f) => ({ id: f.id, value: f.value, decision: decide(f.id.slice(b.brand!.id.length + 1)) }));
  await updateStore((data) => {
    const applied = applyFactReview(data.facts.filter((f) => f.brandId === b.brand!.id), { decisions }, new Date().toISOString());
    if (!applied.ok) throw new Error(applied.error);
    data.facts = data.facts.filter((f) => f.brandId !== b.brand!.id).concat(applied.facts);
    data.brands.find((x) => x.id === b.brand!.id)!.factsReviewedAt = new Date().toISOString();
  });
}

async function deep(focusArea: FocusArea, decide?: Parameters<typeof review>[1]) {
  const snap = await snapshot();
  await review(snap, decide);
  const started = await startDeepAudit(snap, focusArea, MOCK);
  if (!started.ok) throw new Error(started.error);
  const status = await runSnapshotToEnd(started.auditId, MOCK);
  return { status, bundle: (await getSnapshotBundle(started.auditId))! };
}

const actionFor = (b: Awaited<ReturnType<typeof deep>>["bundle"], match: RegExp) => {
  const issue = b.issues.find((i) => match.test(i.observedIssue))!;
  expect(issue, String(match)).toBeDefined();
  return { issue, action: b.actions.find((a) => a.issueId === issue.id)! };
};

describe("deep audit", () => {
  it("needs reviewed facts, and only offers areas with sample data in mock mode", async () => {
    const snap = await snapshot();
    expect(await startDeepAudit(snap, "pricing_plans", MOCK)).toMatchObject({ ok: false, error: /confirm your facts/i });
    await review(snap);
    expect(MOCK_DEEP_AREAS).toEqual(["pricing_plans", "use_cases_customers"]);
    expect((await startDeepAudit(snap, "integrations", MOCK)).ok).toBe(false);
  });

  it("rejects a review with no confirmed facts", () => {
    const fact = { id: "f", brandId: "b", factType: "pricing" as const, value: "x", sourceUrl: "https://a.example.com", confirmed: false, version: 1, confirmedAt: null };
    expect(applyFactReview([fact], { decisions: [{ id: "f", decision: "reject", value: "x" }] }, "2026-11-23T00:00:00.000Z").ok).toBe(false);
  });

  it("asks 5 questions in one focus area, 3 fresh runs each", async () => {
    const { status, bundle } = await deep("pricing_plans");
    expect(status.status).toBe("done");
    expect(bundle.runs).toHaveLength(15);
    expect(new Set(bundle.runs.map((r) => r.promptId)).size).toBe(5);
    expect(bundle.runs.map((r) => r.runNumber).sort()).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3]);
  });

  it("drops 'potential' once facts are confirmed, and never calls an omission inaccurate", async () => {
    const { bundle } = await deep("use_cases_customers");
    expect(bundle.claims.every((c) => !c.potential)).toBe(true);
    expect(bundle.gaps.every((g) => !g.potential)).toBe(true);
    for (const i of bundle.issues) {
      if (i.gapIds.length) expect(i.kind === "visibility_gap" || i.kind === "coverage_gap").toBe(true);
      if (i.kind === "inaccurate") expect(i.gapIds).toHaveLength(0);
    }
  });

  it("recommends investigation, not new content, when the website already states the fact clearly", async () => {
    const { bundle } = await deep("pricing_plans");
    const { issue, action } = actionFor(bundle, /Free plan for up to 5 users/);
    expect(issue.kind).toBe("inaccurate");
    expect(action.contentCheckResult).toBe("stated_clearly");
    expect(action.outcome).toBe("investigate");
    expect(action.destination).toMatch(/reviews\.example\.org/);
    expect(bundle.drafts.some((d) => d.actionId === action.id)).toBe(false);
  });

  it("recommends a correction with a fully supported draft when the site doesn't state it clearly", async () => {
    const { bundle } = await deep("use_cases_customers");
    const { issue, action } = actionFor(bundle, /contradict.*5 to 50 people/);
    expect(issue).toMatchObject({ kind: "inaccurate", evidenceStrength: "high", impact: 3 });
    expect(action).toMatchObject({ outcome: "correction", contentCheckResult: "stated_unclearly", status: "Draft" });
    const draft = bundle.drafts.find((d) => d.actionId === action.id)!;
    expect(draft.text).toContain("5 to 50 people");
    expect(draft.claimChecks.every((c) => c.supported && c.factId)).toBe(true);
  });

  it("supports 'No correction recommended' for a one-off, low-impact claim", async () => {
    const { bundle } = await deep("use_cases_customers");
    const { issue, action } = actionFor(bundle, /formal approval workflows/);
    expect(issue).toMatchObject({ kind: "unverifiable", evidenceStrength: "low", impact: 1 });
    expect(action.outcome).toBe("no_correction");
  });

  it("asks to confirm a fact first instead of drafting from an unconfirmed one", async () => {
    const { bundle } = await deep("use_cases_customers", (key) => (key === "f-usecase-size" ? "skip" : "confirm"));
    const { issue, action } = actionFor(bundle, /5 to 50 people/);
    expect(issue.kind).toBe("inaccurate");
    expect(action.outcome).toBe("investigate");
    expect(action.recommendedAction).toMatch(/confirm this fact first/i);
  });

  it("ranks issues by priority, highest first", async () => {
    const { bundle } = await deep("use_cases_customers");
    const w = { high: 3, medium: 2, low: 1 } as const;
    const scores = bundle.issues.map((i) => i.relevance * i.impact * w[i.evidenceStrength]);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

describe("draft approval and status", () => {
  async function correction() {
    const { bundle } = await deep("use_cases_customers");
    return actionFor(bundle, /contradict.*5 to 50 people/).action;
  }

  it("blocks approval while any sentence is unsupported, then allows it once linked", async () => {
    const action = await correction();
    const text = "FlowOps is built for startup teams of 5 to 50 people. Teams switch in a day.";
    const saved = await applyActionOp(action.id, { op: "save", text, links: [] });
    expect(saved).toMatchObject({ ok: true, action: { status: "In review" }, draft: { revisionNumber: 2 } });
    expect(await applyActionOp(action.id, { op: "approve" })).toMatchObject({ ok: false, error: /1 sentence/ });
    await applyActionOp(action.id, {
      op: "save",
      text,
      links: [{ claimText: "Teams switch in a day.", sourceUrl: "https://flowops.example.com/onboarding" }],
    });
    expect(await applyActionOp(action.id, { op: "approve" })).toMatchObject({ ok: true, action: { status: "Approved" } });
  });

  it("only allows Exported after approval, and Published only after export", async () => {
    const action = await correction();
    expect((await applyActionOp(action.id, { op: "export" })).ok).toBe(false);
    expect((await applyActionOp(action.id, { op: "publish" })).ok).toBe(false);
    expect(await applyActionOp(action.id, { op: "approve" })).toMatchObject({ ok: true, action: { status: "Approved" } });
    expect((await applyActionOp(action.id, { op: "publish" })).ok).toBe(false);
    expect(await applyActionOp(action.id, { op: "export" })).toMatchObject({ ok: true, action: { status: "Exported" } });
    expect(await applyActionOp(action.id, { op: "publish" })).toMatchObject({ ok: true, action: { status: "Published" } });
  });

  it("editing after approval creates a new revision that needs approval again", async () => {
    const action = await correction();
    await applyActionOp(action.id, { op: "approve" });
    const r = await applyActionOp(action.id, { op: "save", text: "FlowOps is used by more than 1,200 startups.", links: [] });
    expect(r).toMatchObject({ ok: true, action: { status: "In review" }, draft: { approvedAt: null } });
  });

  it("has no draft operations for investigation outcomes", async () => {
    const { bundle } = await deep("pricing_plans");
    const { action } = actionFor(bundle, /Free plan for up to 5 users/);
    expect((await applyActionOp(action.id, { op: "approve" })).ok).toBe(false);
  });
});
