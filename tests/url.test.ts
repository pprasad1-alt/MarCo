import { describe, expect, it } from "vitest";
import { validateUrl } from "@/lib/url";

describe("URL validation", () => {
  it.each([
    "ftp://flowops.com",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "localhost",
    "http://localhost:3000",
    "localhost:3000",
    "http://app.localhost",
    "127.0.0.1",
    "http://127.0.0.1:8080/admin",
    "http://2130706433", // 127.0.0.1 written as a number
    "192.168.1.10",
    "https://192.168.0.1/router",
    "http://10.0.0.5",
    "http://172.20.1.1",
    "http://169.254.169.254/latest/meta-data", // cloud metadata
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://printer.local",
    "http://user:pass@flowops.com",
    "intranet",
    "",
    "not a url",
  ])("rejects %s with a friendly message", (input) => {
    const r = validateUrl(input);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.length).toBeGreaterThan(10);
      expect(r.error).not.toMatch(/exception|undefined|TypeError/i);
    }
  });

  it.each([
    ["flowops.com", "https://flowops.com/"],
    ["https://www.acme.io/pricing", "https://www.acme.io/pricing"],
    ["http://example.org", "http://example.org/"],
    ["  Acme.com  ", "https://acme.com/"],
  ])("accepts %s", (input, expected) => {
    const r = validateUrl(input);
    expect(r).toMatchObject({ ok: true, url: expected });
  });

  it("explains which protocols are allowed", () => {
    const r = validateUrl("ftp://flowops.com");
    expect(r.ok === false && r.error).toMatch(/http:\/\/ or https:\/\//);
  });
});
