/**
 * Audit runner: free snapshots and deep audits.
 *
 * Runs ONE small step per call and saves progress after each, so:
 *  - each server request stays short (Vercel time limits),
 *  - the progress screen can show "Question X of 10",
 *  - an error or reload resumes where it stopped instead of starting over.
 *
 * Snapshot:   reading -> facts -> asking (x10) -> classifying (x10) -> done
 * Deep audit: asking (5 questions x 3 runs = 15) -> classifying (x15) -> diagnosing -> done
 *
 * Failed calls retry once, then surface a plain-language error. Results are
 * never invented to fill a gap.
 */
import { randomUUID } from "node:crypto";
import { AnswerAnalysis, classifyAnswer } from "@/lib/classify";
import { diagnose } from "@/lib/diagnose";
import { extractWebsite, NotConnectedError } from "@/lib/extract";
import { extractFacts, toUnconfirmedFacts } from "@/lib/facts";
import { getMode, type ModeInfo } from "@/lib/mode";
import { MOCK_DEEP_AREAS, MOCK_ERROR_HOST, MOCK_FIXTURE, mockAnswerFor, mockDelay } from "@/lib/mock";
import { DEEP_RUNS_PER_QUESTION, fillPrompt, getDeepPrompts, getPrompt, getSnapshotPrompts } from "@/lib/prompts";
import { readStore, updateStore, type StoreData } from "@/lib/store";
import { validateUrl } from "@/lib/url";
import { FOCUS_AREA_LABELS, type Audit, type AuditRun, type Brand, type FocusArea, type Prompt, type RawCitation, type SnapshotProgress } from "@/lib/types";

export type SnapshotStatus = Pick<SnapshotProgress, "auditId" | "step" | "index" | "totalQuestions" | "status" | "error">;

export class SnapshotNotFoundError extends Error {}

function now(): string {
  return new Date().toISOString();
}

function toStatus(p: SnapshotProgress): SnapshotStatus {
  const { auditId, step, index, totalQuestions, status, error } = p;
  return { auditId, step, index, totalQuestions, status, error };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

/** Validates the URL and creates the brand, audit and progress records. */
export async function startSnapshot(
  inputUrl: string,
  mode: ModeInfo = getMode(),
): Promise<{ ok: true; auditId: string } | { ok: false; error: string }> {
  const checked = validateUrl(inputUrl);
  if (!checked.ok) return checked;

  // MOCK: the profile comes from the FlowOps fixture, whatever URL was entered.
  // Live mode will derive name/category/competitors from the extracted facts.
  if (mode.mode !== "MOCK") {
    return { ok: false, error: new NotConnectedError("Live audits").message };
  }

  const brandId = randomUUID();
  const auditId = randomUUID();
  const createdAt = now();
  const brand: Brand = {
    id: brandId,
    url: checked.url,
    name: MOCK_FIXTURE.brand.name,
    category: MOCK_FIXTURE.brand.category,
    competitors: MOCK_FIXTURE.brand.competitors,
    ownerId: null,
    createdAt,
  };

  await updateStore((data) => {
    data.brands.push(brand);
    data.audits.push({ id: auditId, brandId, type: "snapshot", focusArea: null, baselineAuditId: null, createdAt });
    data.progress.push({
      auditId,
      step: "reading",
      index: 0,
      totalQuestions: getSnapshotPrompts().length,
      status: "running",
      error: null,
      attempts: 0,
      updatedAt: createdAt,
    });
  });
  return { ok: true, auditId };
}

/** Starts a deep audit: 5 questions in one focus area, 3 fresh runs each. Needs reviewed facts. */
export async function startDeepAudit(
  snapshotId: string,
  focusArea: FocusArea,
  mode: ModeInfo = getMode(),
): Promise<{ ok: true; auditId: string } | { ok: false; error: string }> {
  if (mode.mode !== "MOCK") return { ok: false, error: new NotConnectedError("Live audits").message };
  if (!MOCK_DEEP_AREAS.includes(focusArea)) {
    return {
      ok: false,
      error: `Sample data for “${FOCUS_AREA_LABELS[focusArea]}” isn't available in mock mode. Choose another focus area.`,
    };
  }
  const auditId = randomUUID();
  const createdAt = now();
  const result = await updateStore((data) => {
    const snapshot = data.audits.find((a) => a.id === snapshotId);
    const brand = snapshot && data.brands.find((b) => b.id === snapshot.brandId);
    if (!snapshot || !brand) return { ok: false as const, error: "We couldn't find that snapshot. Please start a new one." };
    if (!brand.factsReviewedAt) return { ok: false as const, error: "Confirm your facts before running a deep audit." };
    const total = getDeepPrompts(focusArea).length * DEEP_RUNS_PER_QUESTION;
    data.audits.push({ id: auditId, brandId: brand.id, type: "deep", focusArea, baselineAuditId: null, createdAt });
    data.progress.push({ auditId, step: "asking", index: 0, totalQuestions: total, status: "running", error: null, attempts: 0, updatedAt: createdAt });
    return { ok: true as const, auditId };
  });
  return result;
}

/** Which question to ask, and which run of it, for each answer slot in an audit. */
export function auditPlan(audit: Pick<Audit, "type" | "focusArea">): { prompt: Prompt; runNumber: number }[] {
  if (audit.type === "snapshot" || !audit.focusArea) return getSnapshotPrompts().map((prompt) => ({ prompt, runNumber: 1 }));
  return getDeepPrompts(audit.focusArea).flatMap((prompt) =>
    Array.from({ length: DEEP_RUNS_PER_QUESTION }, (_, i) => ({ prompt, runNumber: i + 1 })),
  );
}

// ---------------------------------------------------------------------------
// Asking the AI (mock now; Gemini later, same return type)
// ---------------------------------------------------------------------------

async function askAI(
  prompt: Prompt,
  promptText: string,
  ctx: { mode: ModeInfo; brandUrl: string; userRetries: number; index: number; runNumber: number; isSnapshot: boolean },
): Promise<{ answer: string; citations: RawCitation[]; modelId: string }> {
  if (ctx.mode.mode !== "MOCK") throw new NotConnectedError("Gemini audits");
  await mockDelay();
  // Demo of the error state: fails on question 4 until the user presses "Try again".
  if (ctx.isSnapshot && new URL(ctx.brandUrl).hostname === MOCK_ERROR_HOST && ctx.index === 3 && ctx.userRetries === 0) {
    throw new Error("The AI service didn't respond (mock error for testing).");
  }
  const fixture = mockAnswerFor(prompt.id, ctx.runNumber);
  if (!fixture) throw new Error(`No mock answer for question ${prompt.id}.`);
  void promptText;
  return { answer: fixture.answer, citations: fixture.citations, modelId: "mock-fixture" };
}

async function analyzeAnswer(run: AuditRun, prompt: Prompt, mode: ModeInfo, brandId: string): Promise<AnswerAnalysis> {
  if (mode.mode !== "MOCK") throw new NotConnectedError("Answer classification (Gemini)");
  const fixture = mockAnswerFor(prompt.id, run.runNumber);
  if (!fixture) throw new Error(`No mock analysis for question ${prompt.id}.`);
  // Fixture fact keys -> this brand's stored fact ids.
  const id = (key: string) => `${brandId}-${key}`;
  return AnswerAnalysis.parse({
    claims: fixture.analysis.claims.map((c) => ({ ...c, factId: c.factId ? id(c.factId) : null })),
    relevantFactIds: fixture.analysis.relevantFactIds.map(id),
  });
}

// ---------------------------------------------------------------------------
// Advance one step
// ---------------------------------------------------------------------------

function load(data: StoreData, auditId: string) {
  const progress = data.progress.find((p) => p.auditId === auditId);
  const audit = data.audits.find((a) => a.id === auditId);
  const brand = audit && data.brands.find((b) => b.id === audit.brandId);
  if (!progress || !audit || !brand) throw new SnapshotNotFoundError("Audit not found.");
  return { progress, audit, brand };
}

async function runStep(auditId: string, mode: ModeInfo): Promise<SnapshotStatus> {
  // Read current state (no work inside the store lock: AI calls can be slow).
  const snapshot = await updateStore((data) => {
    const { progress, brand, audit } = load(data, auditId);
    return {
      progress: { ...progress },
      brand: { ...brand },
      audit: { ...audit },
      pages: data.extractionCache[brand.url]?.pages,
      runs: data.auditRuns.filter((r) => r.auditId === auditId),
      facts: data.facts.filter((f) => f.brandId === brand.id),
    };
  });
  const { progress, brand, audit } = snapshot;
  if (progress.status === "done") return toStatus(progress);

  const plan = auditPlan(audit);
  const isSnapshot = audit.type === "snapshot";

  // Do the work for the current step, retrying once on failure.
  type Apply = (data: StoreData, p: SnapshotProgress) => void;
  const work = async (): Promise<Apply> => {
    switch (progress.step) {
      case "reading": {
        // Website extraction is cached by URL; audit answers never are.
        const pages = snapshot.pages ?? (await extractWebsite(brand.url, mode));
        return (data, p) => {
          data.extractionCache[brand.url] = { pages, cachedAt: now() };
          p.step = "facts";
        };
      }
      case "facts": {
        const pages = snapshot.pages ?? (await extractWebsite(brand.url, mode));
        const facts = toUnconfirmedFacts(brand.id, await extractFacts(pages, mode));
        return (data, p) => {
          data.facts = data.facts.filter((f) => f.brandId !== brand.id).concat(facts);
          p.step = "asking";
          p.index = 0;
        };
      }
      case "asking": {
        const { prompt, runNumber } = plan[progress.index];
        const promptText = fillPrompt(prompt, brand);
        // Every run is a fresh call: audit answers are never cached.
        const result = await askAI(prompt, promptText, {
          mode,
          brandUrl: brand.url,
          userRetries: progress.attempts,
          index: progress.index,
          runNumber,
          isSnapshot,
        });
        const run: AuditRun = {
          id: `${auditId}-r${progress.index + 1}`,
          auditId,
          promptId: prompt.id,
          promptVersion: prompt.version,
          promptText,
          runNumber,
          mode: mode.mode,
          modelId: result.modelId,
          groundingSettings: mode.mode === "GEMINI_AUDIT" ? { googleSearch: true } : {},
          generationSettings: {},
          timestamp: now(),
          answer: result.answer,
          rawCitations: result.citations,
          status: "completed",
          error: null,
        };
        return (data, p) => {
          data.auditRuns = data.auditRuns.filter((r) => r.id !== run.id).concat(run);
          p.index += 1;
          if (p.index >= p.totalQuestions) {
            p.step = "classifying";
            p.index = 0;
          }
        };
      }
      case "classifying": {
        const run = snapshot.runs[progress.index];
        if (!run) throw new Error("An AI answer is missing, so it can't be classified.");
        const prompt = getPrompt(run.promptId);
        const analysis = await analyzeAnswer(run, prompt, mode, brand.id);
        const { claims, gaps } = classifyAnswer({
          run,
          prompt,
          brandName: brand.name,
          facts: snapshot.facts,
          analysis,
          // Snapshots run before fact review, so their findings stay "potential".
          factsReviewed: isSnapshot ? false : Boolean(brand.factsReviewedAt),
        });
        return (data, p) => {
          data.claims = data.claims.filter((c) => c.auditRunId !== run.id).concat(claims);
          data.gaps = data.gaps.filter((g) => g.auditRunId !== run.id).concat(gaps);
          p.index += 1;
          if (p.index >= snapshot.runs.length) {
            p.index = 0;
            if (isSnapshot) {
              p.step = "done";
              p.status = "done";
            } else {
              p.step = "diagnosing";
            }
          }
        };
      }
      case "diagnosing": {
        const fresh = await readStore();
        const runIds = new Set(snapshot.runs.map((r) => r.id));
        const result = await diagnose({
          auditId,
          brand,
          facts: snapshot.facts,
          runs: snapshot.runs,
          claims: fresh.claims.filter((c) => runIds.has(c.auditRunId)),
          gaps: fresh.gaps.filter((g) => runIds.has(g.auditRunId)),
          pages: snapshot.pages ?? [],
          mode,
        });
        return (data, p) => {
          const oldIssues = new Set(data.issues.filter((i) => i.auditId === auditId).map((i) => i.id));
          const oldActions = new Set(data.actions.filter((a) => oldIssues.has(a.issueId)).map((a) => a.id));
          data.issues = data.issues.filter((i) => !oldIssues.has(i.id)).concat(result.issues);
          data.actions = data.actions.filter((a) => !oldActions.has(a.id)).concat(result.actions);
          data.drafts = data.drafts.filter((d) => !oldActions.has(d.actionId)).concat(result.drafts);
          p.step = "done";
          p.status = "done";
        };
      }
      default:
        return () => undefined;
    }
  };

  let apply: Apply | null = null;
  let failure: unknown = null;
  for (let attempt = 0; attempt < 2 && !apply; attempt++) {
    try {
      apply = await work();
    } catch (err) {
      failure = err;
      if (err instanceof NotConnectedError) break; // retrying won't help
    }
  }

  return updateStore((data) => {
    const { progress: p } = load(data, auditId);
    if (apply) {
      apply(data, p);
      if (p.status !== "done") p.status = "running";
      p.error = null;
      p.attempts = 0;
    } else {
      p.status = "failed";
      p.attempts += 1;
      p.error = friendlyError(failure);
    }
    p.updatedAt = now();
    return toStatus(p);
  });
}

function friendlyError(err: unknown): string {
  if (err instanceof NotConnectedError) return err.message;
  const detail = err instanceof Error ? err.message : "";
  const base = "Something went wrong while running your snapshot. Your progress is saved, so you can try again.";
  return detail ? `${base} Details: ${detail}` : base;
}

// One step at a time per snapshot, even if the browser sends duplicate requests.
const inFlight = new Map<string, Promise<SnapshotStatus>>();

export function advanceSnapshot(auditId: string, mode: ModeInfo = getMode()): Promise<SnapshotStatus> {
  const existing = inFlight.get(auditId);
  if (existing) return existing;
  const p = runStep(auditId, mode).finally(() => inFlight.delete(auditId));
  inFlight.set(auditId, p);
  return p;
}

/** Runs every remaining step (used by tests and scripts). */
export async function runSnapshotToEnd(auditId: string, mode: ModeInfo = getMode()): Promise<SnapshotStatus> {
  for (let i = 0; i < 100; i++) {
    const s = await advanceSnapshot(auditId, mode);
    if (s.status !== "running") return s;
  }
  throw new Error("Snapshot did not finish.");
}
