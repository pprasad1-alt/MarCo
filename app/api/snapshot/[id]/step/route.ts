import { NextResponse } from "next/server";
import { advanceSnapshot, SnapshotNotFoundError } from "@/lib/audit";

/** Runs the next step of a snapshot (one question at a time) and returns progress. */
export async function POST(_request: Request, ctx: RouteContext<"/api/snapshot/[id]/step">) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await advanceSnapshot(id));
  } catch (err) {
    if (err instanceof SnapshotNotFoundError) {
      return NextResponse.json({ error: "We couldn't find that snapshot. Please start a new one." }, { status: 404 });
    }
    console.error("snapshot step failed", err);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
