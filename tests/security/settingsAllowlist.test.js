/**
 * Security tests: Settings PATCH allowlist (mass assignment prevention)
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  ALLOWED_SETTINGS_KEYS,
  filterAllowedSettings,
} from "../../src/lib/settingsAllowlist.js";

describe("ALLOWED_SETTINGS_KEYS", () => {
  it("includes expected keys", () => {
    assert.ok(ALLOWED_SETTINGS_KEYS.includes("requireLogin"));
    assert.ok(ALLOWED_SETTINGS_KEYS.includes("cloudEnabled"));
    assert.ok(ALLOWED_SETTINGS_KEYS.includes("cloudUrl"));
  });

  it("excludes password (route sets it only after hashing via newPassword/currentPassword)", () => {
    assert.strictEqual(ALLOWED_SETTINGS_KEYS.includes("password"), false);
  });
});

describe("filterAllowedSettings", () => {
  it("keeps only allowed keys", () => {
    const body = {
      requireLogin: false,
      cloudUrl: "https://evil.com",
      evilKey: "must-be-dropped",
      __proto__: { polluted: true },
    };
    const out = filterAllowedSettings(body);
    assert.strictEqual(out.requireLogin, false);
    assert.strictEqual(out.cloudUrl, "https://evil.com");
    assert.strictEqual("evilKey" in out, false);
    assert.strictEqual("polluted" in out, false);
  });

  it("returns empty object when body has no allowed keys", () => {
    const body = { randomKey: 1, another: "x" };
    const out = filterAllowedSettings(body);
    assert.deepStrictEqual(out, {});
  });

  it("includes all provided allowed keys", () => {
    const body = {
      cloudEnabled: true,
      requireLogin: true,
      observabilityEnabled: false,
    };
    const out = filterAllowedSettings(body);
    assert.strictEqual(out.cloudEnabled, true);
    assert.strictEqual(out.requireLogin, true);
    assert.strictEqual(out.observabilityEnabled, false);
  });

  it("drops client-supplied password (prevents bypass of hashing and current password check)", () => {
    const body = { password: "plaintext-or-precomputed-hash" };
    const out = filterAllowedSettings(body);
    assert.strictEqual("password" in out, false);
  });
});
