/**
 * SSRF mitigation: allow only HTTPS and block private/localhost hosts for outbound fetch.
 * @param {string} baseUrl
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateBaseUrlForFetch(baseUrl) {
  if (!baseUrl || typeof baseUrl !== "string") {
    return { ok: false, error: "Invalid base URL" };
  }
  let url;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    return { ok: false, error: "Invalid base URL" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "Only HTTPS URLs are allowed for validation" };
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) {
    return { ok: false, error: "Localhost URLs are not allowed for validation" };
  }
  // IPv4 private / link-local
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = url.hostname.match(ipv4);
  if (m) {
    const [, a, b] = m.map(Number);
    if (a === 10) return { ok: false, error: "Private IP ranges are not allowed" };
    if (a === 172 && b >= 16 && b <= 31) return { ok: false, error: "Private IP ranges are not allowed" };
    if (a === 192 && b === 168) return { ok: false, error: "Private IP ranges are not allowed" };
    if (a === 127) return { ok: false, error: "Loopback is not allowed" };
    if (a === 169 && b === 254) return { ok: false, error: "Link-local is not allowed" };
  }
  return { ok: true };
}
