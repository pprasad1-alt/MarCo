/**
 * Picks MarCo's run mode from environment variables.
 *
 *   MOCK          no Gemini key: fixture data, nothing real is called.
 *   GEMINI_AUDIT  Gemini key present: native Google Search grounding (preferred).
 *   SIMULATION    MARCO_AUDIT_MODE=simulation plus Gemini and Tavily keys:
 *                 Gemini answers only from pages MarCo retrieves via Tavily.
 *
 * Call getMode() on the server only. It reads secret env vars, which are not
 * available in the browser (a client-side call would just report MOCK).
 * Pass the resulting ModeInfo to client components as a prop.
 */

export const MODES = ["MOCK", "SIMULATION", "GEMINI_AUDIT"] as const;
export type Mode = (typeof MODES)[number];

export type ModeInfo = {
  mode: Mode;
  /** Short name shown to the user, e.g. in the banner. */
  label: string;
  /** The exact disclaimer text required by CLAUDE.md. */
  bannerText: string;
  /** Plain-language reason this mode was chosen (useful when setting up keys). */
  reason: string;
};

export const MODE_COPY: Record<Mode, { label: string; bannerText: string }> = {
  MOCK: {
    label: "Mock mode",
    bannerText: "Mock data. Not a real audit.",
  },
  SIMULATION: {
    label: "Simulation",
    bannerText: "Simulation; not a measure of real-world Gemini visibility.",
  },
  GEMINI_AUDIT: {
    label: "Gemini audit",
    bannerText: "Gemini audit",
  },
};

type Env = Record<string, string | undefined>;

function has(env: Env, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function info(mode: Mode, reason: string): ModeInfo {
  return { mode, ...MODE_COPY[mode], reason };
}

/** Pure function (easy to test): decides the mode from a set of env vars. */
export function resolveMode(env: Env): ModeInfo {
  const requested = (env.MARCO_AUDIT_MODE ?? "").trim().toLowerCase() || "auto";

  if (!has(env, "GEMINI_API_KEY")) {
    return info("MOCK", "No GEMINI_API_KEY is set, so MarCo uses fixture data.");
  }

  if (requested === "simulation") {
    if (!has(env, "TAVILY_API_KEY")) {
      return info(
        "MOCK",
        "MARCO_AUDIT_MODE is 'simulation' but TAVILY_API_KEY is missing, so MarCo falls back to fixture data.",
      );
    }
    return info("SIMULATION", "MARCO_AUDIT_MODE is 'simulation' and both Gemini and Tavily keys are set.");
  }

  if (requested !== "auto") {
    return info(
      "MOCK",
      `MARCO_AUDIT_MODE has an unknown value ('${requested}'). Use 'auto' or 'simulation'. Falling back to fixture data.`,
    );
  }

  return info("GEMINI_AUDIT", "GEMINI_API_KEY is set, so MarCo uses Gemini with Google Search grounding.");
}

/** Mode info for a stored mode (e.g. the mode an audit started in). */
export function modeInfoFor(mode: Mode, reason = "Fixed when this audit started."): ModeInfo {
  return info(mode, reason);
}

/** Reads the real environment. Server-side only. */
export function getMode(): ModeInfo {
  return resolveMode(process.env);
}
