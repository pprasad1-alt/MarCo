/**
 * Supabase backend for lib/store.ts, using Supabase's REST API (PostgREST) with
 * plain fetch: no extra library. Server-side only.
 *
 * Tables (supabase/schema.sql):
 *   marco_brands(brand_id, data jsonb, version int)  one document per brand
 *   marco_index(key, brand_id)                        "audit:<id>", "action:<id>", "issue:<id>", "sample"
 */
import type { StoreBackend, StoreData, StoreKey } from "@/lib/store";

type Row = { brand_id: string; data: StoreData; version: number };

export class StoreError extends Error {}

const MAX_ATTEMPTS = 6;

function emptyData(): StoreData {
  return {
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
  };
}

/** Index keys for everything a brand document contains. */
function indexKeys(data: StoreData): string[] {
  return [
    ...data.audits.map((a) => `audit:${a.id}`),
    ...data.actions.map((a) => `action:${a.id}`),
    ...data.issues.map((i) => `issue:${i.id}`),
  ];
}

export function createSupabaseBackend(baseUrl: string, secretKey: string, fetchImpl: typeof fetch = fetch): StoreBackend {
  const rest = `${baseUrl.replace(/\/+$/, "").replace(/\/rest\/v1$/, "")}/rest/v1`;
  const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    apikey: secretKey,
    // Legacy JWT keys also go in Authorization; new "sb_secret_" keys go in apikey only.
    ...(secretKey.startsWith("eyJ") ? { Authorization: `Bearer ${secretKey}` } : {}),
    "Content-Type": "application/json",
    ...extra,
  });

  async function call(pathAndQuery: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await fetchImpl(`${rest}/${pathAndQuery}`, { ...init, cache: "no-store" });
    } catch (err) {
      throw new StoreError("Couldn't reach the database. Please try again.", { cause: err });
    }
    return res;
  }

  async function json<T>(res: Response, what: string): Promise<T> {
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new StoreError(`Database error while ${what} (HTTP ${res.status}). ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  async function brandIdFor(key: StoreKey): Promise<string | null> {
    if ("brandId" in key) return key.brandId || null;
    if ("newBrandId" in key) return key.newBrandId;
    const k = "auditId" in key ? `audit:${key.auditId}` : "actionId" in key ? `action:${key.actionId}` : `issue:${key.issueId}`;
    const rows = await json<{ brand_id: string }[]>(
      await call(`marco_index?key=eq.${encodeURIComponent(k)}&select=brand_id`, { headers: headers() }),
      "looking up a record",
    );
    return rows[0]?.brand_id ?? null;
  }

  async function load(brandId: string): Promise<Row | null> {
    const rows = await json<Row[]>(
      await call(`marco_brands?brand_id=eq.${encodeURIComponent(brandId)}&select=brand_id,data,version`, { headers: headers() }),
      "loading data",
    );
    return rows[0] ?? null;
  }

  /** Insert a new brand row. Returns false if another server created it first. */
  async function insert(brandId: string, data: StoreData): Promise<boolean> {
    const res = await call("marco_brands", {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ brand_id: brandId, data, version: 1 }),
    });
    if (res.status === 409) return false;
    if (!res.ok) await json<unknown>(res, "saving data");
    return true;
  }

  /** Save only if nobody else saved since we loaded (version check). */
  async function replace(brandId: string, version: number, data: StoreData): Promise<boolean> {
    const res = await call(`marco_brands?brand_id=eq.${encodeURIComponent(brandId)}&version=eq.${version}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify({ data, version: version + 1, updated_at: new Date().toISOString() }),
    });
    const rows = await json<Row[]>(res, "saving data");
    return rows.length > 0;
  }

  async function writeIndex(brandId: string, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const res = await call("marco_index?on_conflict=key", {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(keys.map((key) => ({ key, brand_id: brandId }))),
    });
    if (!res.ok) await json<unknown>(res, "saving the index");
  }

  return {
    name: "supabase",

    async update(key, fn) {
      const brandId = await brandIdFor(key);
      if (!brandId) {
        // Unknown id: let the caller see empty data and report "not found". Nothing is saved.
        return fn(emptyData());
      }
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const row = await load(brandId);
        const data: StoreData = row ? { ...emptyData(), ...row.data } : emptyData();
        const before = JSON.stringify(data);
        const keysBefore = new Set(indexKeys(data));
        const result = await fn(data);
        if (JSON.stringify(data) === before) return result; // nothing changed

        const saved = row ? await replace(brandId, row.version, data) : await insert(brandId, data);
        if (!saved) {
          // Another server saved first: wait a moment, reload, and run the change again.
          await new Promise((r) => setTimeout(r, 40 * (attempt + 1) + Math.random() * 40));
          continue;
        }
        await writeIndex(
          brandId,
          indexKeys(data).filter((k) => !keysBefore.has(k)),
        );
        return result;
      }
      throw new StoreError("The database was busy. Please try again.");
    },

    async read(key) {
      const brandId = await brandIdFor(key);
      if (!brandId) return emptyData();
      const row = await load(brandId);
      return row ? { ...emptyData(), ...row.data } : emptyData();
    },

    async getSampleBrandId() {
      const rows = await json<{ brand_id: string }[]>(
        await call("marco_index?key=eq.sample&select=brand_id", { headers: headers() }),
        "looking up the sample",
      );
      return rows[0]?.brand_id ?? null;
    },

    async setSampleBrandId(brandId) {
      await writeIndex(brandId, ["sample"]);
    },
  };
}
