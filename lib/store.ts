/**
 * MarCo's data layer. Every read and write goes through these functions.
 *
 * Two backends, same data shapes (lib/types.ts):
 *  - Supabase (when SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are set):
 *    each brand is one JSON document in `marco_brands`; `marco_index` maps audit,
 *    action and issue ids to their brand. Writes use optimistic locking (a version
 *    number), so two servers saving at once never overwrite each other.
 *    Schema: supabase/schema.sql. Server-side only: the secret key never reaches the browser.
 *  - Local JSON file (.data/marco-store.json) for development and tests.
 *
 * Callers pass a StoreKey saying which brand they need, so Supabase only loads
 * that brand's data. Everything one audit refers to lives inside the same brand.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createSupabaseBackend } from "@/lib/store-supabase";
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

/** Which brand's data a call needs. */
export type StoreKey =
  | { brandId: string }
  | { newBrandId: string }
  | { auditId: string }
  | { actionId: string }
  | { issueId: string };

export const emptyStore = (): StoreData => ({
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

export interface StoreBackend {
  name: "file" | "supabase";
  update<T>(key: StoreKey, fn: (data: StoreData) => T | Promise<T>): Promise<T>;
  read(key: StoreKey): Promise<StoreData>;
  /** The brand id of the most recent sample report, if any. */
  getSampleBrandId(): Promise<string | null>;
  setSampleBrandId(brandId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Local file backend
// ---------------------------------------------------------------------------

function dataFile(): string {
  if (process.env.MARCO_DATA_DIR) return path.join(process.env.MARCO_DATA_DIR, "marco-store.json");
  const dir = process.env.VERCEL ? "/tmp/marco" : path.join(process.cwd(), ".data");
  return path.join(dir, "marco-store.json");
}

type FileDoc = StoreData & { sampleBrandId?: string | null };

async function loadFile(): Promise<FileDoc> {
  try {
    const text = await fs.readFile(dataFile(), "utf8");
    return { ...emptyStore(), ...(JSON.parse(text) as Partial<FileDoc>) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
    throw err;
  }
}

async function saveFile(data: FileDoc): Promise<void> {
  const file = dataFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file); // atomic replace: never leaves a half-written file
}

// Serialize writes within this server process so updates don't overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

const fileBackend: StoreBackend = {
  name: "file",
  update(_key, fn) {
    const run = queue.then(async () => {
      const data = await loadFile();
      const result = await fn(data);
      await saveFile(data);
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  },
  async read() {
    await queue;
    return loadFile();
  },
  async getSampleBrandId() {
    return (await this.read({ brandId: "" }) as FileDoc).sampleBrandId ?? null;
  },
  async setSampleBrandId(brandId) {
    await this.update({ brandId }, (d) => {
      (d as FileDoc).sampleBrandId = brandId;
    });
  },
};

// ---------------------------------------------------------------------------
// Backend selection
// ---------------------------------------------------------------------------

let supabase: StoreBackend | null = null;

export function storeBackend(): StoreBackend {
  // SUPABASE_URL (server-only) is preferred; NEXT_PUBLIC_SUPABASE_URL also works. The URL isn't secret either way.
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    supabase ??= createSupabaseBackend(url, key);
    return supabase;
  }
  return fileBackend;
}

/** Read-modify-write. The callback mutates the data and may run again if another server saved first. */
export function updateStore<T>(key: StoreKey, fn: (data: StoreData) => T | Promise<T>): Promise<T> {
  return storeBackend().update(key, fn);
}

export function readStore(key: StoreKey): Promise<StoreData> {
  return storeBackend().read(key);
}

// ---------------------------------------------------------------------------
// Bundles used by pages
// ---------------------------------------------------------------------------

/** Everything needed to show one audit (snapshot or deep). Returns null if it doesn't exist. */
export async function getSnapshotBundle(auditId: string) {
  return bundleFrom(await readStore({ auditId }), auditId);
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
  const data = await readStore({ actionId });
  const action = data.actions.find((a) => a.id === actionId);
  const issue = action && data.issues.find((i) => i.id === action.issueId);
  const bundle = issue && bundleFrom(data, issue.auditId);
  if (!action || !issue || !bundle) return null;
  const drafts = data.drafts.filter((d) => d.actionId === actionId).sort((a, b) => a.revisionNumber - b.revisionNumber);
  return { action, issue, bundle, drafts, latestDraft: drafts.at(-1) ?? null };
}

/** The most recent finished sample snapshot, if any (for "See a sample report"). */
export async function findFinishedSample(sampleUrl: string): Promise<string | null> {
  const backend = storeBackend();
  const brandId = backend.name === "file" ? null : await backend.getSampleBrandId();
  if (backend.name === "supabase" && !brandId) return null;
  const data = await backend.read(brandId ? { brandId } : { brandId: "" });
  const sampleBrands = new Set(data.brands.filter((b) => b.url === sampleUrl).map((b) => b.id));
  const done = data.audits
    .filter((a) => a.type === "snapshot" && sampleBrands.has(a.brandId))
    .filter((a) => data.progress.find((p) => p.auditId === a.id)?.status === "done")
    .filter((a) => data.auditRuns.some((r) => r.auditId === a.id && r.mode === "MOCK"))
    .at(-1);
  return done?.id ?? null;
}
