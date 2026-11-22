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
import type { Audit, AuditRun, Brand, Claim, ExtractedPage, Fact, Gap, SnapshotProgress } from "@/lib/types";

export type StoreData = {
  brands: Brand[];
  facts: Fact[];
  audits: Audit[];
  auditRuns: AuditRun[];
  claims: Claim[];
  gaps: Gap[];
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

/** Everything needed to show one snapshot. Returns null if the audit doesn't exist. */
export async function getSnapshotBundle(auditId: string) {
  const data = await readStore();
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
    progress: data.progress.find((p) => p.auditId === auditId) ?? null,
  };
}
export type SnapshotBundle = NonNullable<Awaited<ReturnType<typeof getSnapshotBundle>>>;
