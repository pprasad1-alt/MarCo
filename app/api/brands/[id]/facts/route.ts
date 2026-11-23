import { NextResponse } from "next/server";
import { applyFactReview, FactReview } from "@/lib/facts";
import { reopenDraftsForChangedFacts } from "@/lib/actions";
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
    // Facts whose meaning changed: edited wording, or confirmed/rejected status flipped.
    const changed = new Set(
      applied.facts
        .filter((f) => {
          const old = brandFacts.find((o) => o.id === f.id);
          return old && (old.value !== f.value || old.confirmed !== f.confirmed || Boolean(old.rejected) !== Boolean(f.rejected));
        })
        .map((f) => f.id),
    );
    data.facts = data.facts.filter((f) => f.brandId !== id).concat(applied.facts);
    brand.factsReviewedAt = at;
    const reopened = reopenDraftsForChangedFacts(data, id, changed);
    return { ok: true as const, reopened: reopened.length };
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, reopenedDrafts: result.reopened });
}
