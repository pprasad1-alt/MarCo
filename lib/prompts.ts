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
import { Prompt, type Brand, type FocusArea } from "@/lib/types";

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

  // Additional questions used by deep audits (5 per focus area).
  {
    id: "pf-discovery-sprint-planning",
    focusArea: "product_features",
    type: "discovery",
    questionTemplate: "Which {category} tools are best for sprint planning and roadmaps?",
    version: 1,
  },
  {
    id: "pf-fact-time-tracking",
    focusArea: "product_features",
    type: "fact_verification",
    questionTemplate: "Does {brand} have built-in time tracking?",
    version: 1,
  },
  {
    id: "pf-fact-standout",
    focusArea: "product_features",
    type: "fact_verification",
    questionTemplate: "What makes {brand} different from {competitor1}?",
    version: 1,
  },
  {
    id: "pp-discovery-affordable",
    focusArea: "pricing_plans",
    type: "discovery",
    questionTemplate: "What is the most affordable {category} for a startup of about 20 people?",
    version: 1,
  },
  {
    id: "pp-fact-paid-plan",
    focusArea: "pricing_plans",
    type: "fact_verification",
    questionTemplate: "What does {brand}'s paid plan include, and how is it billed?",
    version: 1,
  },
  {
    id: "pp-discovery-per-user",
    focusArea: "pricing_plans",
    type: "discovery",
    questionTemplate: "Which {category} tools charge per user, and roughly how much?",
    version: 1,
  },
  {
    id: "int-discovery-slack",
    focusArea: "integrations",
    type: "discovery",
    questionTemplate: "Which {category} tools work best with Slack?",
    version: 1,
  },
  {
    id: "int-fact-github",
    focusArea: "integrations",
    type: "fact_verification",
    questionTemplate: "Does {brand} integrate with GitHub, and what does the integration do?",
    version: 1,
  },
  {
    id: "int-discovery-design",
    focusArea: "integrations",
    type: "discovery",
    questionTemplate: "Which {category} tools integrate with Figma and Google Drive?",
    version: 1,
  },
  {
    id: "cmp-discovery-lightweight",
    focusArea: "comparisons_alternatives",
    type: "discovery",
    questionTemplate: "What is a lighter alternative to {competitor2} for a small team?",
    version: 1,
  },
  {
    id: "cmp-fact-vs",
    focusArea: "comparisons_alternatives",
    type: "fact_verification",
    questionTemplate: "How does {brand} compare to {competitor1}?",
    version: 1,
  },
  {
    id: "cmp-fact-vs2",
    focusArea: "comparisons_alternatives",
    type: "fact_verification",
    questionTemplate: "Should a startup choose {brand} or {competitor2}?",
    version: 1,
  },
  {
    id: "uc-discovery-team-size",
    focusArea: "use_cases_customers",
    type: "discovery",
    questionTemplate: "What {category} works best for a startup with 5 to 50 employees?",
    version: 1,
  },
  {
    id: "uc-discovery-growing",
    focusArea: "use_cases_customers",
    type: "discovery",
    questionTemplate: "Which {category} tools do fast-growing startups use most?",
    version: 1,
  },
  {
    id: "uc-fact-fit",
    focusArea: "use_cases_customers",
    type: "fact_verification",
    questionTemplate: "Is {brand} a good fit for a 20-person startup?",
    version: 1,
  },
  {
    id: "uc-fact-customers",
    focusArea: "use_cases_customers",
    type: "fact_verification",
    questionTemplate: "What kinds of customers use {brand}?",
    version: 1,
  },
  {
    id: "co-discovery-trusted",
    focusArea: "company_credibility",
    type: "discovery",
    questionTemplate: "Which {category} companies are most trusted by startups?",
    version: 1,
  },
  {
    id: "co-discovery-new",
    focusArea: "company_credibility",
    type: "discovery",
    questionTemplate: "What are some newer {category} companies worth considering?",
    version: 1,
  },
  {
    id: "co-fact-location",
    focusArea: "company_credibility",
    type: "fact_verification",
    questionTemplate: "Where is {brand} based?",
    version: 1,
  },
  {
    id: "co-fact-trust",
    focusArea: "company_credibility",
    type: "fact_verification",
    questionTemplate: "Is {brand} a reliable, established company?",
    version: 1,
  },
];

// Validate the library at load time: a typo here should fail loudly.
PROMPT_LIBRARY.forEach((p) => Prompt.parse(p));

/** The 10 free-snapshot questions (across all focus areas), in the order they are asked. */
export const SNAPSHOT_PROMPT_IDS = [
  "pf-discovery-best-tools",
  "pf-fact-main-features",
  "pp-fact-cost",
  "pp-discovery-free-plans",
  "int-fact-integrations",
  "int-discovery-engineering",
  "cmp-discovery-alternatives",
  "cmp-discovery-head-to-head",
  "uc-fact-who-uses",
  "co-fact-founded",
];

/** Deep audit: 5 questions in one focus area, a balanced mix of both question types. */
export const DEEP_PROMPT_IDS: Record<FocusArea, string[]> = {
  product_features: [
    "pf-discovery-best-tools",
    "pf-discovery-sprint-planning",
    "pf-fact-main-features",
    "pf-fact-time-tracking",
    "pf-fact-standout",
  ],
  pricing_plans: ["pp-discovery-free-plans", "pp-discovery-affordable", "pp-discovery-per-user", "pp-fact-cost", "pp-fact-paid-plan"],
  integrations: ["int-discovery-engineering", "int-discovery-slack", "int-discovery-design", "int-fact-integrations", "int-fact-github"],
  comparisons_alternatives: [
    "cmp-discovery-alternatives",
    "cmp-discovery-head-to-head",
    "cmp-discovery-lightweight",
    "cmp-fact-vs",
    "cmp-fact-vs2",
  ],
  use_cases_customers: ["uc-discovery-team-size", "uc-discovery-growing", "uc-fact-who-uses", "uc-fact-fit", "uc-fact-customers"],
  company_credibility: ["co-discovery-trusted", "co-discovery-new", "co-fact-founded", "co-fact-location", "co-fact-trust"],
};

/** Runs per question in a deep audit or re-audit. */
export const DEEP_RUNS_PER_QUESTION = 3;

export function getDeepPrompts(focusArea: FocusArea): Prompt[] {
  return DEEP_PROMPT_IDS[focusArea].map(getPrompt);
}

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
