/**
 * Security tests: OAuth redirect_uri validation
 * Ensures only same-origin or localhost callback URLs are accepted.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { getAllowedRedirectUri } from "../../src/lib/oauth/utils/redirectUri.js";

describe("getAllowedRedirectUri", () => {
  const origin = "http://localhost:20128";

  it("returns same-origin /callback when no redirect_uri given", () => {
    assert.strictEqual(getAllowedRedirectUri(origin, null), "http://localhost:20128/callback");
    assert.strictEqual(getAllowedRedirectUri(origin, undefined), "http://localhost:20128/callback");
    assert.strictEqual(getAllowedRedirectUri(origin, ""), "http://localhost:20128/callback");
  });

  it("accepts same-origin /callback", () => {
    assert.strictEqual(getAllowedRedirectUri(origin, "http://localhost:20128/callback"), "http://localhost:20128/callback");
  });

  it("accepts localhost with different port and /callback", () => {
    assert.strictEqual(getAllowedRedirectUri(origin, "http://localhost:8080/callback"), "http://localhost:8080/callback");
    assert.strictEqual(getAllowedRedirectUri(origin, "http://localhost:3000/callback"), "http://localhost:3000/callback");
  });

  it("accepts 127.0.0.1 /callback", () => {
    assert.strictEqual(getAllowedRedirectUri(origin, "http://127.0.0.1:20128/callback"), "http://127.0.0.1:20128/callback");
    assert.strictEqual(getAllowedRedirectUri(origin, "http://127.0.0.1/callback"), "http://127.0.0.1/callback");
  });

  it("rejects external redirect_uri (open redirect)", () => {
    assert.strictEqual(getAllowedRedirectUri(origin, "https://evil.com/callback"), null);
    assert.strictEqual(getAllowedRedirectUri(origin, "https://attacker.org/oauth/callback"), null);
    assert.strictEqual(getAllowedRedirectUri(origin, "http://evil.com/callback"), null);
  });

  it("rejects when path is not /callback", () => {
    assert.strictEqual(getAllowedRedirectUri(origin, "http://localhost:20128/"), null);
    assert.strictEqual(getAllowedRedirectUri(origin, "http://localhost:20128/dashboard"), null);
    assert.strictEqual(getAllowedRedirectUri(origin, "https://evil.com/"), null);
  });

  it("rejects invalid URL", () => {
    assert.strictEqual(getAllowedRedirectUri(origin, "not-a-url"), null);
    assert.strictEqual(getAllowedRedirectUri(origin, "javascript:alert(1)"), null);
  });

  it("accepts path that ends with /callback", () => {
    assert.strictEqual(
      getAllowedRedirectUri(origin, "http://localhost:20128/oauth/callback"),
      "http://localhost:20128/oauth/callback"
    );
  });
});
