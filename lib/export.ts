/**
 * Draft exports (Markdown and HTML). MarCo never publishes: these files are for
 * the customer to review and paste into their own site.
 *
 * Draft text is treated as untrusted (it may contain anything the customer or
 * the AI typed), so the HTML export escapes everything and only links to
 * http(s) sources.
 */
import type { Draft, Fact } from "@/lib/types";

export type ExportContext = { brandName: string; destination: string; facts: Fact[]; approvedAt?: string | null };

function sourceFor(check: Draft["claimChecks"][number], facts: Fact[]) {
  const fact = check.factId ? facts.find((f) => f.id === check.factId) : undefined;
  return { fact, url: fact?.sourceUrl ?? check.sourceUrl ?? null };
}

export function draftToMarkdown(d: Draft, ctx: ExportContext): string {
  // Markdown special characters in the draft are escaped so they show as typed.
  const md = (t: string) => t.replace(/([\\`*_{}\[\]()#+!|<>])/g, "\\$1");
  return [
    `# Correction draft for ${md(ctx.brandName)}`,
    "",
    `Destination: ${md(ctx.destination)}`,
    `Revision ${d.revisionNumber}`,
    "",
    ...d.text.split(/\n+/).map(md).flatMap((p) => [p, ""]),
    "## Where each sentence comes from",
    "",
    ...d.claimChecks.map((c) => {
      const { fact, url } = sourceFor(c, ctx.facts);
      return `- “${md(c.claimText)}” → ${fact ? `confirmed fact: ${md(fact.value)}` : "source"}${url ? ` (${url})` : ""}`;
    }),
    "",
    "Exported from MarCo. MarCo never publishes anything: publish this yourself, then mark it as published in MarCo.",
    "",
  ].join("\n");
}

export function escapeHtml(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function draftToHtml(d: Draft, ctx: ExportContext): string {
  const paragraphs = d.text
    .split(/\n+/)
    .filter((p) => p.trim())
    .map((p) => `    <p>${escapeHtml(p)}</p>`)
    .join("\n");
  const sources = d.claimChecks
    .map((c) => {
      const { fact, url } = sourceFor(c, ctx.facts);
      const href = safeUrl(url);
      const label = escapeHtml(fact ? `Confirmed fact: ${fact.value}` : "Source");
      const link = href ? ` (<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${escapeHtml(href)}</a>)` : "";
      return `      <li>“${escapeHtml(c.claimText)}” → ${label}${link}</li>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(`Correction draft for ${ctx.brandName}`)}</title>
</head>
<body>
  <!-- Exported from MarCo. Paste the section below into your page. MarCo never publishes anything. -->
  <section>
${paragraphs}
  </section>
  <hr>
  <aside>
    <p>Destination: ${escapeHtml(ctx.destination)} · Revision ${d.revisionNumber}</p>
    <p>Where each sentence comes from:</p>
    <ul>
${sources}
    </ul>
  </aside>
</body>
</html>
`;
}
