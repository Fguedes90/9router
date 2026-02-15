/**
 * Auth and URL validation for /forward and /forward-raw endpoints.
 * When FORWARD_SECRET is set in env, requests must send X-Forward-Secret.
 * When not set, forward endpoints reject (no default secret to avoid bypass).
 */

function isPrivateOrLocalHost(hostname) {
  if (!hostname || typeof hostname !== "string") return true;
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
  // IPv4 private / link-local / loopback
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = hostname.match(ipv4);
  if (m) {
    const [, a, b, c] = m.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
  }
  // IPv6 loopback / link-local
  if (h === "[::1]" || h.startsWith("fe80:") || h.startsWith("::1")) return true;
  return false;
}

/**
 * Validate targetUrl for forward: must be HTTPS and not private/local.
 * @param {string} targetUrl
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateForwardUrl(targetUrl) {
  try {
    const url = new URL(targetUrl);
    if (url.protocol !== "https:") {
      return { ok: false, error: "Only HTTPS URLs are allowed" };
    }
    if (isPrivateOrLocalHost(url.hostname)) {
      return { ok: false, error: "Private or localhost URLs are not allowed" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Invalid URL" };
  }
}

/**
 * Check Forward-Secret header against env.FORWARD_SECRET.
 * Auth is required only when FORWARD_SECRET is set; when not set, reject (no default secret).
 * @param {Request} request
 * @param {Object} env
 * @returns {{ ok: boolean, error?: string }}
 */
export function checkForwardAuth(request, env) {
  const secret = env?.FORWARD_SECRET?.trim();
  if (!secret) {
    return { ok: false, error: "Forward endpoint is not configured (set FORWARD_SECRET)" };
  }
  const header = request.headers.get("X-Forward-Secret") ?? request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!header.trim() || header.trim() !== secret) {
    return { ok: false, error: "Missing or invalid X-Forward-Secret" };
  }
  return { ok: true };
}

export function jsonError(message, status = 401) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
