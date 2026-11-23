import { NextResponse } from "next/server";
import { applyFactReview, FactReview } from "@/lib/facts";
import { updateStore } from "@/lib/store";

/** Saves the customer's fact review: confirm, edit or reject each fact. */
export async function POST(request: Request, ctx: RouteContext<"/api/brands/[id]/facts">) {
  const { id } = await ctx.params;
  const parsed = FactReview.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Something in the form isn't right." }, { status: 400 });
  }
  const result = await updateStore((data) => {
    const brand = data.brands.find((b) => b.id === id);
    if (!brand) return { ok: false as const, error: "We couldn't find that company.", status: 404 };
    const at = new Date().toISOString();
    const brandFacts = data.facts.filter((f) => f.brandId === id);
    const applied = applyFactReview(brandFacts, parsed.data, at);
    if (!applied.ok) return { ...applied, status: 400 };
    data.facts = data.facts.filter((f) => f.brandId !== id).concat(applied.facts);
    brand.factsReviewedAt = at;
    return { ok: true as const };
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
