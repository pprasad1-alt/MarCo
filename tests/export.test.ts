import { describe, expect, it } from "vitest";
import { draftToHtml, draftToMarkdown } from "@/lib/export";
import type { Draft, Fact } from "@/lib/types";

const fact: Fact = {
  id: "f1",
  brandId: "b",
  factType: "pricing",
  value: "Free plan for up to 5 users",
  sourceUrl: "https://flowops.example.com/pricing",
  confirmed: true,
  version: 1,
  confirmedAt: "2026-11-28T00:00:00.000Z",
};

const draft = (text: string, sourceUrl: string | null = null): Draft => ({
  id: "d",
  actionId: "a",
  revisionNumber: 2,
  text,
  claimChecks: [
    { claimText: "FlowOps has a free plan for up to 5 users.", factId: "f1", sourceUrl: fact.sourceUrl, supported: true },
    ...(sourceUrl ? [{ claimText: "Other.", factId: null, sourceUrl, supported: true }] : []),
  ],
  approvedAt: "2026-11-28T00:00:00.000Z",
  exportedAt: null,
  publishedAt: null,
});

const ctx = { brandName: "FlowOps", destination: "Pricing page", facts: [fact] };

describe("draft exports", () => {
  it("HTML export escapes everything, so draft text can't inject scripts or markup", () => {
    const html = draftToHtml(draft(`Hi <script>alert("x")</script> <img src=x onerror=alert(1)> & "quotes"`), ctx);
    expect(html).not.toMatch(/<script>alert/);
    expect(html).not.toMatch(/<img/);
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("&amp; &quot;quotes&quot;");
  });

  it("HTML export only links to http(s) sources", () => {
    const html = draftToHtml(draft("Text.", "javascript:alert(1)"), ctx);
    expect(html).not.toMatch(/href="javascript:/);
    expect(html).toContain('href="https://flowops.example.com/pricing"');
  });

  it("Markdown export includes the text, the destination and where each sentence comes from", () => {
    const md = draftToMarkdown(draft("FlowOps has a free plan for up to 5 users."), ctx);
    expect(md).toContain("Destination: Pricing page");
    expect(md).toContain("FlowOps has a free plan for up to 5 users.");
    expect(md).toContain("confirmed fact: Free plan for up to 5 users (https://flowops.example.com/pricing)");
    expect(md).toMatch(/never publishes/);
  });
});
