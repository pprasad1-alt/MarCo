import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { runSnapshotToEnd, startDeepAudit, startSnapshot } from "@/lib/audit";
import { applyActionOp } from "@/lib/actions";
import { resolveMode } from "@/lib/mode";
import { createSupabaseBackend } from "@/lib/store-supabase";
import { getSnapshotBundle, storeBackend, updateStore } from "@/lib/store";

/** A tiny in-memory stand-in for Supabase's REST API (only what MarCo uses). */
function fakeSupabase() {
  const brands = new Map<string, { brand_id: string; data: unknown; version: number }>();
  const index = new Map<string, string>();
  const calls: string[] = [];
  const reply = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const table = url.pathname.split("/").pop()!;
    const q = (k: string) => url.searchParams.get(k)?.replace(/^eq\./, "");
    calls.push(`${method} ${table}`);
    const h = new Headers(init?.headers);
    if (h.get("apikey") !== "test-secret") return reply(401, { message: "bad key" });
    if (table === "marco_index" && method === "GET") {
      const b = index.get(decodeURIComponent(q("key")!));
      return reply(200, b ? [{ brand_id: b }] : []);
    }
    if (table === "marco_index" && method === "POST") {
      for (const r of JSON.parse(String(init!.body))) index.set(r.key, r.brand_id);
      return reply(201);
    }
    if (table === "marco_brands" && method === "GET") {
      const row = brands.get(q("brand_id")!);
      return reply(200, row ? [structuredClone(row)] : []);
    }
    if (table === "marco_brands" && method === "POST") {
      const r = JSON.parse(String(init!.body));
      if (brands.has(r.brand_id)) return reply(409, { message: "duplicate" });
      brands.set(r.brand_id, r);
      return reply(201);
    }
    if (table === "marco_brands" && method === "PATCH") {
      const row = brands.get(q("brand_id")!);
      if (!row || row.version !== Number(q("version"))) return reply(200, []);
      const r = JSON.parse(String(init!.body));
      Object.assign(row, { data: r.data, version: r.version });
      return reply(200, [row]);
    }
    return reply(404, { message: "unknown route" });
  };
  return { brands, index, calls, fetchImpl: fetchImpl as typeof fetch };
}

const MOCK = resolveMode({});

describe("Supabase storage", () => {
  const fake = fakeSupabase();
  beforeAll(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret");
    vi.stubGlobal("fetch", fake.fetchImpl);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is used when the Supabase settings are present", () => {
    expect(storeBackend().name).toBe("supabase");
  });

  it("runs a whole snapshot and deep audit, and finds everything again by id", async () => {
    const s = await startSnapshot("https://flowops.com", MOCK);
    if (!s.ok) throw new Error(s.error);
    expect((await runSnapshotToEnd(s.auditId, MOCK)).status).toBe("done");
    expect(fake.brands.size).toBe(1);
    expect(fake.index.get(`audit:${s.auditId}`)).toBe(s.brandId);

    await updateStore({ brandId: s.brandId }, (data) => {
      for (const f of data.facts) Object.assign(f, { confirmed: true, confirmedAt: new Date().toISOString() });
      data.brands[0].factsReviewedAt = new Date().toISOString();
    });
    const d = await startDeepAudit(s.auditId, "use_cases_customers", MOCK);
    if (!d.ok) throw new Error(d.error);
    expect((await runSnapshotToEnd(d.auditId, MOCK)).status).toBe("done");

    const bundle = (await getSnapshotBundle(d.auditId))!;
    expect(bundle.runs).toHaveLength(15);
    const action = bundle.actions.find((a) => a.outcome === "correction")!;
    expect(fake.index.get(`action:${action.id}`)).toBe(s.brandId);
    expect(await applyActionOp(action.id, { op: "approve" })).toMatchObject({ ok: true });
  });

  it("returns 'not found' for an unknown id without saving anything", async () => {
    const before = fake.calls.filter((c) => c.startsWith("POST") || c.startsWith("PATCH")).length;
    expect(await getSnapshotBundle("does-not-exist")).toBeNull();
    expect(await applyActionOp("nope", { op: "approve" })).toMatchObject({ ok: false, status: 404 });
    expect(fake.calls.filter((c) => c.startsWith("POST") || c.startsWith("PATCH")).length).toBe(before);
  });

  it("never loses a change when two servers save the same brand at once", async () => {
    const serverA = createSupabaseBackend("https://example.supabase.co", "test-secret", fake.fetchImpl);
    const serverB = createSupabaseBackend("https://example.supabase.co", "test-secret", fake.fetchImpl);
    await serverA.update({ newBrandId: "race" }, (d) => {
      d.brands.push({ id: "race", url: "https://race.example.com/", name: "Race", category: "x", competitors: [], ownerId: null, createdAt: new Date().toISOString() });
    });
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        (i % 2 ? serverA : serverB).update({ brandId: "race" }, async (d) => {
          await new Promise((r) => setTimeout(r, Math.random() * 5));
          d.facts.push({ id: `f${i}`, brandId: "race", factType: "other", value: `fact ${i}`, sourceUrl: "https://race.example.com/", confirmed: false, version: 1, confirmedAt: null });
        }),
      ),
    );
    const data = await serverA.read({ brandId: "race" });
    expect(data.facts.map((f) => f.id).sort()).toEqual(Array.from({ length: 10 }, (_, i) => `f${i}`).sort());
  });

  it("sends the secret key only in request headers", async () => {
    const seen: Headers[] = [];
    const spy = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Headers(init?.headers));
      return fake.fetchImpl(input, init);
    }) as typeof fetch;
    const b = createSupabaseBackend("https://example.supabase.co/rest/v1/", "test-secret", spy);
    await b.read({ brandId: "race" });
    expect(seen[0].get("apikey")).toBe("test-secret");
    expect(seen[0].get("authorization")).toBeNull(); // only JWT-style keys go in Authorization
  });
});
