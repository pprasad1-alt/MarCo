import { NextResponse } from "next/server";
import { startReAudit } from "@/lib/audit";

/** Starts a re-audit of a finished deep audit (same 5 questions, 3 fresh runs each). */
export async function POST(_request: Request, ctx: RouteContext<"/api/audits/[id]/reaudit">) {
  const { id } = await ctx.params;
  const result = await startReAudit(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ auditId: result.auditId }, { status: 201 });
}
