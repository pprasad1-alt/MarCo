import { NextResponse } from "next/server";
import { z } from "zod";
import { startDeepAudit } from "@/lib/audit";
import { FocusArea } from "@/lib/types";

const Body = z.object({ snapshotId: z.string().min(1), focusArea: FocusArea });

/** Starts a deep audit of one focus area for the brand behind a snapshot. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a focus area." }, { status: 400 });
  const result = await startDeepAudit(parsed.data.snapshotId, parsed.data.focusArea);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ auditId: result.auditId }, { status: 201 });
}
