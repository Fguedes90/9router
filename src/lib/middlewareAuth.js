/**
 * API paths that do not require session auth (use API key or are public).
 * Used by src/middleware.js. Kept in lib for unit tests without next/server.
 */
export const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/settings/require-login",
  "/api/v1/",
  "/api/cloud/auth",
];

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPublicApiPath(pathname) {
  return PUBLIC_API_PREFIXES.some((prefix) => {
    if (pathname === prefix) return true;
    if (prefix.endsWith("/")) return pathname.startsWith(prefix);
    return pathname.startsWith(prefix + "/");
  });
}
