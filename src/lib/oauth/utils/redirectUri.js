/**
 * OAuth redirect_uri validation (prevents code theft via open redirect).
 * Only same-origin /callback or localhost|127.0.0.1 /callback is accepted.
 *
 * @param {string} origin - Request origin (e.g. "http://localhost:20128")
 * @param {string|null|undefined} requestedRedirectUri - Value from client
 * @returns {string|null} Allowed redirect URI or null if rejected
 */
export function getAllowedRedirectUri(origin, requestedRedirectUri) {
  const defaultCallback = `${origin}/callback`;

  if (!requestedRedirectUri) {
    return defaultCallback;
  }
  try {
    const u = new URL(requestedRedirectUri);
    if (u.pathname !== "/callback" && !u.pathname.endsWith("/callback")) {
      return null;
    }
    const sameOrigin = u.origin === origin;
    const localCallback =
      (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
      (u.port === "" || /^\d+$/.test(u.port));
    if (sameOrigin || localCallback) {
      return requestedRedirectUri;
    }
    return null;
  } catch {
    return null;
  }
}
