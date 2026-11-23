import { NextResponse } from "next/server";
import { startSnapshot } from "@/lib/audit";
import { resolveMode } from "@/lib/mode";
import { MOCK_FIXTURE } from "@/lib/mock";
import { readStore } from "@/lib/store";

/**
 * "See a sample report": always the clearly labeled FlowOps mock data, even when
 * live keys are set. Reuses a finished sample if one exists (instant), otherwise
 * runs one through the normal progress screen.
 */
export async function GET(request: Request) {
  const data = await readStore();
  const sampleBrands = new Set(data.brands.filter((b) => b.url === MOCK_FIXTURE.brand.url).map((b) => b.id));
  const done = data.audits
    .filter((a) => a.type === "snapshot" && sampleBrands.has(a.brandId))
    .filter((a) => data.progress.find((p) => p.auditId === a.id)?.status === "done")
    .filter((a) => data.auditRuns.some((r) => r.auditId === a.id && r.mode === "MOCK"))
    .at(-1);
  if (done) return NextResponse.redirect(new URL(`/snapshot/${done.id}/results`, request.url), 303);

  const started = await startSnapshot(MOCK_FIXTURE.brand.url, resolveMode({}));
  if (!started.ok) return NextResponse.redirect(new URL("/", request.url), 303);
  return NextResponse.redirect(new URL(`/snapshot/${started.auditId}`, request.url), 303);
}
