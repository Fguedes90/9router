/**
 * Allowlist of settings keys that can be updated via PATCH /api/settings.
 * Prevents mass assignment of unknown keys.
 */
export const ALLOWED_SETTINGS_KEYS = [
  "cloudEnabled",
  "cloudUrl",
  "stickyRoundRobinLimit",
  "requireLogin",
  "observabilityEnabled",
  "observabilityMaxRecords",
  "observabilityBatchSize",
  "observabilityFlushIntervalMs",
  "observabilityMaxJsonSize",
  "password",
];

/**
 * Filter body to only include allowed settings keys.
 * @param {Record<string, unknown>} body - Raw request body
 * @returns {Record<string, unknown>} Filtered updates
 */
export function filterAllowedSettings(body) {
  const updates = {};
  for (const key of ALLOWED_SETTINGS_KEYS) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }
  return updates;
}
