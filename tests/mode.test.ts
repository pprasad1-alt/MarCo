import { describe, expect, it } from "vitest";
import { resolveMode } from "@/lib/mode";

describe("mode selection", () => {
  it("uses MOCK with no keys, and shows the required banner text", () => {
    expect(resolveMode({})).toMatchObject({ mode: "MOCK", bannerText: "Mock data. Not a real audit." });
  });
  it("uses GEMINI_AUDIT with a Gemini key", () => {
    expect(resolveMode({ GEMINI_API_KEY: "k" }).mode).toBe("GEMINI_AUDIT");
  });
  it("uses SIMULATION only when asked and Tavily is configured", () => {
    expect(resolveMode({ GEMINI_API_KEY: "k", TAVILY_API_KEY: "t", MARCO_AUDIT_MODE: "simulation" }).mode).toBe("SIMULATION");
    expect(resolveMode({ GEMINI_API_KEY: "k", MARCO_AUDIT_MODE: "simulation" }).mode).toBe("MOCK");
  });
});
