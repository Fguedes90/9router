/**
 * API Key utilities for Worker
 * Supports both formats:
 * - New: sk-{machineId}-{keyId}-{crc8}
 * - Old: sk-{random8}
 *
 * In production set API_KEY_SECRET in Worker env (wrangler secret or env var);
 * if unset, legacy default is used for backward compatibility.
 */

const LEGACY_API_KEY_SECRET = "endpoint-proxy-api-key-secret";

/**
 * Generate CRC (8-char HMAC) using Web Crypto API
 * @param {string} machineId
 * @param {string} keyId
 * @param {string} [secret] - API_KEY_SECRET from env; falls back to legacy if omitted
 */
async function generateCrc(machineId, keyId, secret) {
  const effectiveSecret = (secret && secret.trim()) || LEGACY_API_KEY_SECRET;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(effectiveSecret);
  const data = encoder.encode(machineId + keyId);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  
  return hashHex.slice(0, 8);
}

/**
 * Parse API key and extract machineId + keyId
 * @param {string} apiKey
 * @param {string} [apiKeySecret] - env.API_KEY_SECRET; if set, used for CRC verification
 * @returns {Promise<{ machineId: string, keyId: string, isNewFormat: boolean } | null>}
 */
export async function parseApiKey(apiKey, apiKeySecret) {
  if (!apiKey || !apiKey.startsWith("sk-")) return null;

  const parts = apiKey.split("-");
  
  // New format: sk-{machineId}-{keyId}-{crc8} = 4 parts
  if (parts.length === 4) {
    const [, machineId, keyId, crc] = parts;
    
    // Verify CRC (use env secret when provided)
    const expectedCrc = await generateCrc(machineId, keyId, apiKeySecret);
    if (crc !== expectedCrc) return null;
    
    return { machineId, keyId, isNewFormat: true };
  }
  
  // Old format: sk-{random8} = 2 parts
  if (parts.length === 2) {
    return { machineId: null, keyId: parts[1], isNewFormat: false };
  }
  
  return null;
}

/**
 * Extract Bearer token from Authorization header
 * @param {Request} request
 * @returns {string | null}
 */
export function extractBearerToken(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

