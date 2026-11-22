import { NextResponse } from "next/server";
import { startSnapshot } from "@/lib/audit";

/** Starts a free snapshot. Body: { url: string }. */
export async function POST(request: Request) {
  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: "Enter your company's website address." }, { status: 400 });
  }
  if (typeof url !== "string" || url.length > 2048) {
    return NextResponse.json({ error: "Enter your company's website address." }, { status: 400 });
  }
  const result = await startSnapshot(url);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ auditId: result.auditId }, { status: 201 });
}
