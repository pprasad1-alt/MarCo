import { NextResponse } from "next/server";
import { advanceSnapshot, SnapshotNotFoundError } from "@/lib/audit";

/** Runs the next step of any audit (one answer at a time) and returns progress. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await advanceSnapshot(id));
  } catch (err) {
    if (err instanceof SnapshotNotFoundError) {
      return NextResponse.json({ error: "We couldn't find that audit. Please start a new one." }, { status: 404 });
    }
    console.error("audit step failed", err);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
