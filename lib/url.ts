/**
 * URL validation for the company website a user enters.
 *
 * Rules (CLAUDE.md): http/https only; block private, loopback and other
 * internal addresses so MarCo can never be pointed at internal systems.
 * Safe to use in the browser (instant feedback) and on the server (the real check).
 */

export type UrlResult = { ok: true; url: string; hostname: string } | { ok: false; error: string };

const MESSAGES = {
  empty: "Enter your company's website address, for example acme.com.",
  invalid: "That doesn't look like a website address. Try something like acme.com.",
  protocol: "Only website addresses starting with http:// or https:// are supported.",
  credentials: "Remove the username or password from the address and try again.",
  internal: "That address points to a private or local network. Enter your public company website.",
  noDomain: "Enter a full public website address, like acme.com.",
} as const;

/** True for IPv4 addresses in private, loopback, link-local or other reserved ranges. */
function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || // "this" network
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local (incl. cloud metadata 169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 192 && b === 0) || // IETF reserved / test
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  );
}

/** True for IPv6 loopback, unspecified, private (fc00::/7), link-local (fe80::/10) and mapped private IPv4. */
function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::1" || h === "::") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true; // unique local
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true; // link-local
  // IPv4-mapped, e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1
  const mapped = h.match(/^::ffff:(.+)$/);
  if (mapped) {
    const tail = mapped[1];
    if (tail.includes(".")) return isPrivateIPv4(tail);
    const parts = tail.split(":");
    if (parts.length === 2) {
      const n = (parseInt(parts[0], 16) << 16) | parseInt(parts[1], 16);
      const ip = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
      return isPrivateIPv4(ip);
    }
    return true; // unusual form: block to be safe
  }
  return false;
}

function isInternalHostname(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa") ||
    host.endsWith(".lan")
  );
}

export function validateUrl(input: string): UrlResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: MESSAGES.empty };
  if (/\s/.test(raw)) return { ok: false, error: MESSAGES.invalid };

  // Allow "acme.com" without a scheme, but reject any other explicit scheme (ftp:, file:, javascript:...).
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  if (hasScheme && !/^https?:\/\//i.test(raw)) {
    // "localhost:3000" parses as a scheme; treat it as an internal address.
    if (/^localhost:\d+/i.test(raw)) return { ok: false, error: MESSAGES.internal };
    return { ok: false, error: MESSAGES.protocol };
  }
  const candidate = hasScheme ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: MESSAGES.invalid };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, error: MESSAGES.protocol };
  if (url.username || url.password) return { ok: false, error: MESSAGES.credentials };

  // URL() normalizes tricks like http://2130706433 or http://0x7f.1 into dotted IPv4.
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { ok: false, error: MESSAGES.invalid };

  if (isInternalHostname(host) || isPrivateIPv4(host) || isPrivateIPv6(host)) {
    return { ok: false, error: MESSAGES.internal };
  }

  const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[");
  if (!isIp && !host.includes(".")) return { ok: false, error: MESSAGES.noDomain };

  url.hash = "";
  return { ok: true, url: url.toString(), hostname: host };
}
