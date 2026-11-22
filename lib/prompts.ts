/**
 * Versioned prompt library.
 *
 * Templates use placeholders filled from the brand profile:
 *   {brand}        company name (fact-verification questions ONLY)
 *   {category}     e.g. "project management software"
 *   {competitor1}  first listed competitor, {competitor2} second
 *
 * Discovery/comparison questions NEVER name the brand: they measure whether
 * AI includes the brand unprompted. fillPrompt() enforces this.
 *
 * To change a question, add a new version instead of editing in place, so old
 * audits stay comparable (each audit run stores promptId + version + exact text).
 */
import { Prompt, type Brand } from "@/lib/types";

export const PROMPT_LIBRARY: Prompt[] = [
  {
    id: "pf-discovery-best-tools",
    focusArea: "product_features",
    type: "discovery",
    questionTemplate: "What are the best {category} tools for a small startup team?",
    version: 1,
  },
  {
    id: "pf-fact-main-features",
    focusArea: "product_features",
    type: "fact_verification",
    questionTemplate: "What are the main features of {brand}?",
    version: 1,
  },
  {
    id: "pp-fact-cost",
    focusArea: "pricing_plans",
    type: "fact_verification",
    questionTemplate: "How much does {brand} cost, and is there a free plan?",
    version: 1,
  },
  {
    id: "pp-discovery-free-plans",
    focusArea: "pricing_plans",
    type: "discovery",
    questionTemplate: "Which {category} tools have a good free plan for small teams?",
    version: 1,
  },
  {
    id: "int-fact-integrations",
    focusArea: "integrations",
    type: "fact_verification",
    questionTemplate: "Which tools does {brand} integrate with?",
    version: 1,
  },
  {
    id: "int-discovery-engineering",
    focusArea: "integrations",
    type: "discovery",
    questionTemplate: "Which {category} tools have the best integrations for software engineering teams?",
    version: 1,
  },
  {
    id: "cmp-discovery-alternatives",
    focusArea: "comparisons_alternatives",
    type: "discovery",
    questionTemplate: "What are the best alternatives to {competitor1}?",
    version: 1,
  },
  {
    id: "cmp-discovery-head-to-head",
    focusArea: "comparisons_alternatives",
    type: "discovery",
    questionTemplate:
      "How does {competitor1} compare to {competitor2} for a growing startup, and what other options should I consider?",
    version: 1,
  },
  {
    id: "uc-fact-who-uses",
    focusArea: "use_cases_customers",
    type: "fact_verification",
    questionTemplate: "What kinds of companies use {brand}, and what is it best for?",
    version: 1,
  },
  {
    id: "co-fact-founded",
    focusArea: "company_credibility",
    type: "fact_verification",
    questionTemplate: "Who is behind {brand}, and when was it founded?",
    version: 1,
  },
];

// Validate the library at load time: a typo here should fail loudly.
PROMPT_LIBRARY.forEach((p) => Prompt.parse(p));

/** The 10 free-snapshot questions, in the order they are asked. */
export const SNAPSHOT_PROMPT_IDS = PROMPT_LIBRARY.map((p) => p.id);

export function getPrompt(id: string): Prompt {
  const p = PROMPT_LIBRARY.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown prompt: ${id}`);
  return p;
}

export function getSnapshotPrompts(): Prompt[] {
  return SNAPSHOT_PROMPT_IDS.map(getPrompt);
}

type BrandProfile = Pick<Brand, "name" | "category" | "competitors">;

export class PromptError extends Error {}

/** True if `text` names the brand (case-insensitive, whole words). */
export function mentionsBrand(text: string, brandName: string): boolean {
  const name = brandName.trim();
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

/** Fills a template with the brand profile. Throws if a discovery question would name the brand. */
export function fillPrompt(prompt: Prompt, brand: BrandProfile): string {
  if (prompt.type === "discovery" && prompt.questionTemplate.includes("{brand}")) {
    throw new PromptError(`Discovery prompt ${prompt.id} must not use {brand}.`);
  }
  const values: Record<string, string> = {
    brand: brand.name,
    category: brand.category,
    competitor1: brand.competitors[0] ?? "the market leader",
    competitor2: brand.competitors[1] ?? "other popular tools",
  };
  const text = prompt.questionTemplate.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in values)) throw new PromptError(`Unknown placeholder ${match} in prompt ${prompt.id}.`);
    return values[key];
  });
  if (prompt.type === "discovery" && mentionsBrand(text, brand.name)) {
    // e.g. the category or a competitor name contains the brand name.
    throw new PromptError(`Discovery prompt ${prompt.id} would name the brand. Check the category and competitors.`);
  }
  return text;
}
