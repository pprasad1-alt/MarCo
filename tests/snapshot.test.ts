import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { advanceSnapshot, runSnapshotToEnd, startSnapshot } from "@/lib/audit";
import { resolveMode } from "@/lib/mode";
import { MOCK_ERROR_HOST, MOCK_FIXTURE } from "@/lib/mock";
import { buildSnapshotResults } from "@/lib/results";
import { getSnapshotBundle } from "@/lib/store";

const MOCK = resolveMode({});
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "marco-test-"));
  process.env.MARCO_DATA_DIR = dir;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function runMockSnapshot(url = "https://flowops.com") {
  const started = await startSnapshot(url, MOCK);
  if (!started.ok) throw new Error(started.error);
  const status = await runSnapshotToEnd(started.auditId, MOCK);
  const bundle = (await getSnapshotBundle(started.auditId))!;
  return { status, bundle, results: buildSnapshotResults(bundle) };
}

describe("mock snapshot, end to end", () => {
  it("asks 10 questions, one run each, and finishes", async () => {
    const { status, bundle } = await runMockSnapshot();
    expect(status.status).toBe("done");
    expect(bundle.runs).toHaveLength(10);
    expect(bundle.runs.every((r) => r.runNumber === 1 && r.mode === "MOCK" && r.status === "completed")).toBe(true);
  });

  it("includes at least one of every finding type, and one answer without citations", async () => {
    const { results, bundle } = await runMockSnapshot();
    for (const kind of ["accurate", "inaccurate", "unverifiable", "visibility_gap", "coverage_gap"] as const) {
      expect(results.counts[kind], kind).toBeGreaterThan(0);
    }
    expect(bundle.runs.some((r) => r.rawCitations.length === 0)).toBe(true);
  });

  it("labels every snapshot finding as potential, and never calls an omission inaccurate", async () => {
    const { bundle, results } = await runMockSnapshot();
    expect(bundle.facts.every((f) => !f.confirmed)).toBe(true);
    expect(bundle.claims.every((c) => c.potential)).toBe(true);
    expect(bundle.gaps.every((g) => g.potential)).toBe(true);
    const all = results.answers.flatMap((a) => a.findings);
    expect(all.every((f) => f.potential)).toBe(true);
    // Gaps only ever become gap findings.
    const gapIds = new Set(bundle.gaps.map((g) => g.id));
    expect(all.filter((f) => gapIds.has(f.id)).every((f) => f.kind === "visibility_gap" || f.kind === "coverage_gap")).toBe(true);
  });

  it("does not label the uncited answer inaccurate", async () => {
    const { bundle } = await runMockSnapshot();
    const uncited = bundle.runs.filter((r) => r.rawCitations.length === 0).map((r) => r.id);
    expect(bundle.claims.filter((c) => uncited.includes(c.auditRunId)).some((c) => c.label === "inaccurate")).toBe(false);
  });

  it("quotes the AI's exact words", async () => {
    const { bundle } = await runMockSnapshot();
    for (const c of bundle.claims) {
      const run = bundle.runs.find((r) => r.id === c.auditRunId)!;
      expect(run.answer).toContain(c.answerExcerpt);
    }
  });

  it("computes a scorecard with counts and rates, and no combined score", async () => {
    const { results } = await runMockSnapshot();
    const byId = Object.fromEntries(results.scorecard.map((m) => [m.id, m]));
    expect(byId["unaided-mention"]).toMatchObject({ count: 2, total: 5 });
    // Per competitor, with the brand on the same list.
    expect(results.competitors.map((c) => `${c.name} ${c.count}/${c.total}`)).toEqual([
      "Asana 5/5",
      "ClickUp 5/5",
      "Monday.com 3/5",
      "FlowOps 2/5",
    ]);
    // Citation rate = answers citing the company's OWN website; "any source" shown separately.
    expect(byId["citations-discovery"]).toMatchObject({ count: 0, total: 5, secondary: "Any source listed: 4 of 5" });
    expect(byId["citations-fact"]).toMatchObject({ count: 2, total: 5, secondary: "Any source listed: 5 of 5" });
    expect(byId["verified-accuracy"]).toMatchObject({ total: 0 }); // N/A until facts are confirmed
    expect(results.scorecard.some((m) => /overall|total score|visibility score/i.test(m.label))).toBe(false);
    expect(results.topFindings).toHaveLength(3);
    expect(results.topFindings.some((f) => f.kind === "accurate")).toBe(false);
  });

  it("rejects a bad URL before starting", async () => {
    const r = await startSnapshot("ftp://flowops.com", MOCK);
    expect(r.ok).toBe(false);
  });

  it("shows an error, keeps progress, and resumes on Try again", async () => {
    const started = await startSnapshot(`https://${MOCK_ERROR_HOST}`, MOCK);
    if (!started.ok) throw new Error(started.error);
    const failed = await runSnapshotToEnd(started.auditId, MOCK);
    expect(failed).toMatchObject({ status: "failed", step: "asking", index: 3 });
    expect(failed.error).toMatch(/try again/i);
    // Nothing invented: only the 3 answered questions are saved.
    expect((await getSnapshotBundle(started.auditId))!.runs).toHaveLength(3);
    // "Try again" = the next step call.
    const resumed = await advanceSnapshot(started.auditId, MOCK);
    expect(resumed).toMatchObject({ status: "running", index: 4 });
    expect((await runSnapshotToEnd(started.auditId, MOCK)).status).toBe("done");
  });

  it("uses fixture FlowOps profile in mock mode", async () => {
    const { bundle } = await runMockSnapshot("acme.com");
    expect(bundle.brand).toMatchObject({ name: MOCK_FIXTURE.brand.name, url: "https://acme.com/" });
  });
});
