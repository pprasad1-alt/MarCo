import { NextResponse, connection } from "next/server";
import { startSnapshot } from "@/lib/audit";
import { resolveMode } from "@/lib/mode";
import { MOCK_FIXTURE } from "@/lib/mock";
import { findFinishedSample, storeBackend } from "@/lib/store";

/**
 * "See a sample report": always the clearly labeled FlowOps mock data, even when
 * live keys are set. Reuses a finished sample if one exists (instant), otherwise
 * runs one through the normal progress screen.
 */
export async function GET(request: Request) {
  // Only ever run when someone opens the link, never ahead of time during a build.
  await connection();
  try {
    const done = await findFinishedSample(MOCK_FIXTURE.brand.url);
    if (done) return NextResponse.redirect(new URL(`/snapshot/${done}/results`, request.url), 303);
  } catch (err) {
    console.error("sample lookup failed", err); // fall through and start a fresh sample
  }
  const started = await startSnapshot(MOCK_FIXTURE.brand.url, resolveMode({}));
  if (!started.ok) return NextResponse.redirect(new URL("/", request.url), 303);
  await storeBackend()
    .setSampleBrandId(started.brandId)
    .catch((err) => console.error("couldn't remember the sample", err));
  return NextResponse.redirect(new URL(`/snapshot/${started.auditId}`, request.url), 303);
}
