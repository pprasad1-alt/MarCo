/**
 * Tiny JSON-file data layer. Supabase replaces this later; keep every read and
 * write going through these functions so only this file has to change.
 *
 * Data lives in .data/marco-store.json locally (git-ignored). On Vercel, the
 * only writable folder is /tmp, which is per-server and temporary: fine for
 * mock-mode demos, not for real data.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Action, Audit, AuditRun, Brand, Claim, Draft, ExtractedPage, Fact, Gap, Issue, SnapshotProgress } from "@/lib/types";

export type StoreData = {
  brands: Brand[];
  facts: Fact[];
  audits: Audit[];
  auditRuns: AuditRun[];
  claims: Claim[];
  gaps: Gap[];
  issues: Issue[];
  actions: Action[];
  drafts: Draft[];
  progress: SnapshotProgress[];
  /** Website extraction cache, keyed by URL (audit runs are never cached). */
  extractionCache: Record<string, { pages: ExtractedPage[]; cachedAt: string }>;
};

const empty = (): StoreData => ({
  brands: [],
  facts: [],
  audits: [],
  auditRuns: [],
  claims: [],
  gaps: [],
  issues: [],
  actions: [],
  drafts: [],
  progress: [],
  extractionCache: {},
});

function dataFile(): string {
  if (process.env.MARCO_DATA_DIR) return path.join(process.env.MARCO_DATA_DIR, "marco-store.json");
  const dir = process.env.VERCEL ? "/tmp/marco" : path.join(process.cwd(), ".data");
  return path.join(dir, "marco-store.json");
}

async function load(): Promise<StoreData> {
  try {
    const text = await fs.readFile(dataFile(), "utf8");
    return { ...empty(), ...(JSON.parse(text) as Partial<StoreData>) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return empty();
    throw err;
  }
}

async function save(data: StoreData): Promise<void> {
  const file = dataFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file); // atomic replace: never leaves a half-written file
}

// Serialize writes within this server process so updates don't overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

/** Read-modify-write. The callback mutates the data; the result is saved. */
export function updateStore<T>(fn: (data: StoreData) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const data = await load();
    const result = await fn(data);
    await save(data);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function readStore(): Promise<StoreData> {
  await queue;
  return load();
}

/** Everything needed to show one audit (snapshot or deep). Returns null if it doesn't exist. */
export async function getSnapshotBundle(auditId: string) {
  return bundleFrom(await readStore(), auditId);
}

export function bundleFrom(data: StoreData, auditId: string) {
  const audit = data.audits.find((a) => a.id === auditId);
  if (!audit) return null;
  const brand = data.brands.find((b) => b.id === audit.brandId) ?? null;
  // Kept in the order the questions were asked.
  const runs = data.auditRuns.filter((r) => r.auditId === auditId);
  const runIds = new Set(runs.map((r) => r.id));
  return {
    audit,
    brand,
    facts: brand ? data.facts.filter((f) => f.brandId === brand.id) : [],
    runs,
    claims: data.claims.filter((c) => runIds.has(c.auditRunId)),
    gaps: data.gaps.filter((g) => runIds.has(g.auditRunId)),
    issues: data.issues.filter((i) => i.auditId === auditId),
    actions: data.actions.filter((a) => data.issues.some((i) => i.id === a.issueId && i.auditId === auditId)),
    drafts: data.drafts.filter((d) => data.actions.some((a) => a.id === d.actionId)),
    extraction: brand ? data.extractionCache[brand.url]?.pages ?? [] : [],
    progress: data.progress.find((p) => p.auditId === auditId) ?? null,
  };
}
export type SnapshotBundle = NonNullable<ReturnType<typeof bundleFrom>>;

/** The action, its issue, the audit bundle, and the latest draft revision. */
export async function getActionBundle(actionId: string) {
  const data = await readStore();
  const action = data.actions.find((a) => a.id === actionId);
  const issue = action && data.issues.find((i) => i.id === action.issueId);
  const bundle = issue && bundleFrom(data, issue.auditId);
  if (!action || !issue || !bundle) return null;
  const drafts = data.drafts.filter((d) => d.actionId === actionId).sort((a, b) => a.revisionNumber - b.revisionNumber);
  return { action, issue, bundle, drafts, latestDraft: drafts.at(-1) ?? null };
}
