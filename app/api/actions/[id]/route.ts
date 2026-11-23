import { NextResponse } from "next/server";
import { ActionOp, applyActionOp } from "@/lib/actions";

/** Draft lifecycle: save, approve, export, or mark as published (customer only). */
export async function POST(request: Request, ctx: RouteContext<"/api/actions/[id]">) {
  const { id } = await ctx.params;
  const parsed = ActionOp.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "That request isn't valid." }, { status: 400 });
  }
  const result = await applyActionOp(id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  return NextResponse.json(result);
}
