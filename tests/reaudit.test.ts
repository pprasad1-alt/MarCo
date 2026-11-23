import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyActionOp, reopenDraftsForChangedFacts } from "@/lib/actions";
import { runSnapshotToEnd, startDeepAudit, startReAudit, startSnapshot } from "@/lib/audit";
import { compareAudits, comparabilityWarnings } from "@/lib/compare";
import { applyFactReview } from "@/lib/facts";
import { resolveMode } from "@/lib/mode";
import { staleIssueIds } from "@/lib/results";
import { getSnapshotBundle, updateStore } from "@/lib/store";
import type { FocusArea } from "@/lib/types";

const MOCK = resolveMode({});
let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "marco-re-"));
  process.env.MARCO_DATA_DIR = dir;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Saves a fact review the same way the API route does. */
async function saveReview(brandId: string, decide: (key: string, value: string) => { decision: "confirm" | "reject" | "skip"; value?: string }) {
  return updateStore((data) => {
    const brandFacts = data.facts.filter((f) => f.brandId === brandId);
    const decisions = brandFacts.map((f) => {
      const d = decide(f.id.slice(brandId.length + 1), f.value);
      return { id: f.id, decision: d.decision, value: d.value ?? f.value };
    });
    const applied = applyFactReview(brandFacts, { decisions }, new Date().toISOString());
    if (!applied.ok) throw new Error(applied.error);
    const changed = new Set(
      applied.facts
        .filter((f) => {
          const o = brandFacts.find((x) => x.id === f.id)!;
          return o.value !== f.value || o.confirmed !== f.confirmed || Boolean(o.rejected) !== Boolean(f.rejected);
        })
        .map((f) => f.id),
    );
    data.facts = data.facts.filter((f) => f.brandId !== brandId).concat(applied.facts);
    data.brands.find((b) => b.id === brandId)!.factsReviewedAt = new Date().toISOString();
    return reopenDraftsForChangedFacts(data, brandId, changed);
  });
}

async function deepAudit(area: FocusArea = "use_cases_customers") {
  const s = await startSnapshot("https://flowops.com", MOCK);
  if (!s.ok) throw new Error(s.error);
  await runSnapshotToEnd(s.auditId, MOCK);
  const brandId = (await getSnapshotBundle(s.auditId))!.brand!.id;
  await saveReview(brandId, () => ({ decision: "confirm" }));
  const d = await startDeepAudit(s.auditId, area, MOCK);
  if (!d.ok) throw new Error(d.error);
  await runSnapshotToEnd(d.auditId, MOCK);
  return { snapshotId: s.auditId, deepId: d.auditId, brandId };
}

async function reAudit(id: string) {
  const r = await startReAudit(id, MOCK);
  if (!r.ok) throw new Error(r.error);
  expect((await runSnapshotToEnd(r.auditId, MOCK)).status).toBe("done");
  return r.auditId;
}

describe("re-audit", () => {
  it("asks the same 5 questions, 3 runs each, against the deep audit baseline", async () => {
    const { deepId } = await deepAudit();
    const reId = await reAudit(deepId);
    const [base, re] = [(await getSnapshotBundle(deepId))!, (await getSnapshotBundle(reId))!];
    expect(re.audit).toMatchObject({ type: "re_audit", baselineAuditId: deepId, focusArea: "use_cases_customers" });
    expect(re.runs).toHaveLength(15);
    const qs = (b: typeof base) => b.runs.map((r) => `${r.promptId}@${r.promptVersion}#${r.runNumber}`).sort();
    expect(qs(re)).toEqual(qs(base));
  });

  it("always compares with the original deep audit, even when re-auditing a re-audit", async () => {
    const { deepId } = await deepAudit();
    const first = await reAudit(deepId);
    const second = await reAudit(first);
    expect((await getSnapshotBundle(second))!.audit.baselineAuditId).toBe(deepId);
  });

  it("can't re-audit a snapshot", async () => {
    const { snapshotId } = await deepAudit();
    expect((await startReAudit(snapshotId, MOCK)).ok).toBe(false);
  });

  it("reports fewer occurrences where answers improved, and 'no observed change' honestly", async () => {
    const { deepId } = await deepAudit();
    const reId = await reAudit(deepId);
    const cmp = compareAudits((await getSnapshotBundle(deepId))!, (await getSnapshotBundle(reId))!);
    const enterprise = cmp.issues.find((i) => /contradict.*5 to 50 people/.test(i.observedIssue))!;
    expect(enterprise).toMatchObject({ kind: "inaccurate", before: 4, after: 2, change: "fewer" });
    const unchanged = cmp.issues.find((i) => /fast-growing startups/.test(i.observedIssue))!;
    expect(unchanged.change).toBe("same");
    expect(cmp.warnings).toEqual([]);
    expect(cmp.metrics.find((m) => m.id === "verified-accuracy")).toMatchObject({ direction: "up", higherIsBetter: true });
  });

  it("shows no change at all when nothing changed (pricing has no re-audit sample changes)", async () => {
    const { deepId } = await deepAudit("pricing_plans");
    const reId = await reAudit(deepId);
    const cmp = compareAudits((await getSnapshotBundle(deepId))!, (await getSnapshotBundle(reId))!);
    expect(cmp.issues.every((i) => i.change === "same")).toBe(true);
    expect(cmp.metrics.every((m) => m.direction === "same" || m.direction === "not_comparable")).toBe(true);
  });

  it("warns when the model or settings differ", async () => {
    const { deepId } = await deepAudit();
    const reId = await reAudit(deepId);
    const base = (await getSnapshotBundle(deepId))!;
    const re = (await getSnapshotBundle(reId))!;
    re.runs = re.runs.map((r) => ({ ...r, modelId: "gemini-x", groundingSettings: { googleSearch: true } }));
    const w = comparabilityWarnings(base, re);
    expect(w.some((x) => /model changed/.test(x))).toBe(true);
    expect(w.some((x) => /grounding/i.test(x))).toBe(true);
  });

  it("lists corrections the customer marked as published", async () => {
    const { deepId } = await deepAudit();
    const base = (await getSnapshotBundle(deepId))!;
    const action = base.actions.find((a) => a.outcome === "correction")!;
    for (const op of ["approve", "export", "publish"] as const) expect((await applyActionOp(action.id, { op })).ok).toBe(true);
    const reId = await reAudit(deepId);
    const cmp = compareAudits((await getSnapshotBundle(deepId))!, (await getSnapshotBundle(reId))!);
    expect(cmp.published).toHaveLength(1);
  });
});

describe("changing a fact after approving a draft", () => {
  it("sends affected drafts back to review and flags affected findings", async () => {
    const { deepId, brandId } = await deepAudit();
    const base = (await getSnapshotBundle(deepId))!;
    const issue = base.issues.find((i) => /contradict.*5 to 50 people/.test(i.observedIssue))!;
    const action = base.actions.find((a) => a.issueId === issue.id)!;
    expect((await applyActionOp(action.id, { op: "approve" })).ok).toBe(true);
    expect((await applyActionOp(action.id, { op: "export" })).ok).toBe(true);

    const reopened = await saveReview(brandId, (key) =>
      key === "f-usecase-size" ? { decision: "confirm", value: "Built for startup teams of 5 to 100 people" } : { decision: "confirm" },
    );
    expect(reopened).toContain(action.id);

    const after = (await getSnapshotBundle(deepId))!;
    expect(after.actions.find((a) => a.id === action.id)!.status).toBe("In review");
    const latest = after.drafts.filter((d) => d.actionId === action.id).sort((a, b) => a.revisionNumber - b.revisionNumber).at(-1)!;
    expect(latest).toMatchObject({ revisionNumber: 2, approvedAt: null, exportedAt: null });
    // The old sentence ("5 to 50") no longer matches the edited fact, so approval is blocked until fixed.
    expect(latest.claimChecks.some((c) => !c.supported)).toBe(true);
    expect((await applyActionOp(action.id, { op: "approve" })).ok).toBe(false);
    expect(staleIssueIds(after).has(issue.id)).toBe(true);
  });

  it("leaves drafts alone when an unrelated fact changes", async () => {
    const { deepId, brandId } = await deepAudit();
    const action = (await getSnapshotBundle(deepId))!.actions.find((a) => a.outcome === "correction" && true)!;
    await applyActionOp(action.id, { op: "approve" });
    const reopened = await saveReview(brandId, (key) => (key === "f-company-founded" ? { decision: "reject" } : { decision: "confirm" }));
    expect(reopened).not.toContain(action.id);
  });

  it("never changes a Published status", async () => {
    const { deepId, brandId } = await deepAudit();
    const base = (await getSnapshotBundle(deepId))!;
    const action = base.actions.find((a) => a.issueId === base.issues.find((i) => /contradict.*5 to 50/.test(i.observedIssue))!.id)!;
    for (const op of ["approve", "export", "publish"] as const) await applyActionOp(action.id, { op });
    await saveReview(brandId, (key) => (key === "f-usecase-size" ? { decision: "reject" } : { decision: "confirm" }));
    expect((await getSnapshotBundle(deepId))!.actions.find((a) => a.id === action.id)!.status).toBe("Published");
  });
});

describe("audits keep the mode they started in", () => {
  it("a mock sample stays mock through deep audit and re-audit, even with live keys set", async () => {
    const LIVE = resolveMode({ GEMINI_API_KEY: "k" });
    const s = await startSnapshot("https://flowops.example.com/", MOCK);
    if (!s.ok) throw new Error(s.error);
    expect((await runSnapshotToEnd(s.auditId, LIVE)).status).toBe("done");
    const brandId = (await getSnapshotBundle(s.auditId))!.brand!.id;
    await saveReview(brandId, () => ({ decision: "confirm" }));
    const d = await startDeepAudit(s.auditId, "pricing_plans", LIVE);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect((await runSnapshotToEnd(d.auditId, LIVE)).status).toBe("done");
    const r = await startReAudit(d.auditId, LIVE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await runSnapshotToEnd(r.auditId, LIVE)).status).toBe("done");
    expect((await getSnapshotBundle(r.auditId))!.runs.every((x) => x.mode === "MOCK")).toBe(true);
  });

  it("a live snapshot isn't faked with mock data (not connected yet)", async () => {
    const LIVE = resolveMode({ GEMINI_API_KEY: "k" });
    expect(await startSnapshot("https://acme.com", LIVE)).toMatchObject({ ok: false, error: /isn't connected yet/ });
  });
});
