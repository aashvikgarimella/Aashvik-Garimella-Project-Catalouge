import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF-safe server-side fetch for user-supplied URLs.
 *
 * Blocks loopback/private/link-local/metadata addresses (both literal IPs and
 * DNS names that resolve to them), enforces http(s), and follows redirects
 * manually so every hop is re-validated. Returns null instead of throwing.
 */

const MAX_REDIRECTS = 3;

function isPrivateIPv4(ip: string): boolean {
  const o = ip.split(".").map(Number);
  return (
    o[0] === 0 ||
    o[0] === 10 ||
    o[0] === 127 ||
    (o[0] === 100 && o[1] >= 64 && o[1] <= 127) || // CGNAT
    (o[0] === 169 && o[1] === 254) ||              // link-local + cloud metadata
    (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
    (o[0] === 192 && o[1] === 168) ||
    o[0] >= 224                                     // multicast/reserved/broadcast
  );
}

function isPrivateIPv6(ip: string): boolean {
  const low = ip.toLowerCase();
  // Normalize an IPv4-mapped address (::ffff:10.0.0.1) to its IPv4 part.
  const mapped = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return (
    low === "::" ||
    low === "::1" ||
    low.startsWith("fe80:") || // link-local
    low.startsWith("fc") ||    // ULA fc00::/7
    low.startsWith("fd")
  );
}

function isPrivateIP(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateIPv4(ip);
  if (v === 6) return isPrivateIPv6(ip);
  return true; // not an IP — caller resolves first
}

/** True when the URL is http(s) and its host does not point at a private/internal address. */
async function isSafeUrl(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (isIP(host)) return !isPrivateIP(host);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return false;
  }
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIP(a.address));
  } catch {
    return false; // unresolvable — refuse
  }
}

export type SafeFetchOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Extra hosts to always allow (e.g. our own Supabase storage). */
  allowHosts?: string[];
};

/**
 * Fetch a user-supplied URL with SSRF protections. Returns the final Response
 * (redirects already followed and validated) or null if blocked/failed.
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<Response | null> {
  const { timeoutMs = 8000, headers = {}, allowHosts = [] } = opts;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const allowed = allowHosts.includes(url.hostname) || (await isSafeUrl(url));
      if (!allowed) return null;

      const res = await fetch(url, { signal: controller.signal, headers, redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        url = new URL(loc, url); // relative redirects resolve against current hop
        continue;
      }
      return res;
    }
    return null; // too many redirects
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
