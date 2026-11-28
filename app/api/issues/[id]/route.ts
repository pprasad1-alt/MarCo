import { NextResponse } from "next/server";
import { z } from "zod";
import { setIssueDismissed } from "@/lib/actions";

/** The customer marks an issue as "not an issue" (or undoes that). */
export async function POST(request: Request, ctx: RouteContext<"/api/issues/[id]">) {
  const { id } = await ctx.params;
  const parsed = z.object({ dismissed: z.boolean(), reason: z.string().trim().max(500).optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That request isn't valid." }, { status: 400 });
  if (!(await setIssueDismissed(id, parsed.data.dismissed, parsed.data.reason || undefined))) {
    return NextResponse.json({ error: "We couldn't find that issue." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
