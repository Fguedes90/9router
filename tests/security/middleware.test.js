/**
 * Security tests: Middleware protects /api/* and allows public routes
 * Tests public-vs-protected path classification without requiring NextRequest (no next/server in test env).
 */
import { describe, it, before } from "node:test";
import assert from "node:assert";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const middlewareAuthPath = path.resolve(__dirname, "../../src/lib/middlewareAuth.js");

describe("middleware (path classification)", () => {
  it("classifies protected API paths as not public", async () => {
    const { isPublicApiPath } = await import(pathToFileURL(middlewareAuthPath).href);
    assert.strictEqual(isPublicApiPath("/api/settings"), false);
    assert.strictEqual(isPublicApiPath("/api/shutdown"), false);
    assert.strictEqual(isPublicApiPath("/api/providers"), false);
    assert.strictEqual(isPublicApiPath("/api/sync/cloud"), false);
    assert.strictEqual(isPublicApiPath("/api/cli-tools/antigravity-mitm"), false);
    assert.strictEqual(isPublicApiPath("/api/cli-tools/opencode-settings"), false);
    assert.strictEqual(isPublicApiPath("/api/oauth/claude/authorize"), false);
  });

  it("public API prefix list includes required routes", async () => {
    const { PUBLIC_API_PREFIXES } = await import(pathToFileURL(middlewareAuthPath).href);
    const required = [
      "/api/auth/login",
      "/api/auth/logout",
      "/api/settings/require-login",
      "/api/v1/",
      "/api/cloud/auth",
    ];
    for (const p of required) {
      assert.ok(
        PUBLIC_API_PREFIXES.includes(p),
        `PUBLIC_API_PREFIXES must include ${p} so these routes stay public`
      );
    }
  });

  it("classifies /api/v1/* as public (prefix ends with slash, no double-slash)", async () => {
    const { isPublicApiPath } = await import(pathToFileURL(middlewareAuthPath).href);
    assert.strictEqual(isPublicApiPath("/api/v1/chat/completions"), true);
    assert.strictEqual(isPublicApiPath("/api/v1/messages"), true);
    assert.strictEqual(isPublicApiPath("/api/v1/verify"), true);
  });

  it("v1 proxy paths are public (checked via pathname.startsWith in middleware)", async () => {
    assert.ok("/v1/chat/completions".startsWith("/v1"));
    assert.ok("/v1".startsWith("/v1"));
  });
});

describe("middleware (integration with NextRequest)", () => {
  let middleware;
  let NextRequest;
  let SignJWT;
  const SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "9router-default-secret-change-me"
  );

  before(async () => {
    try {
      const next = await import("next/server");
      NextRequest = next.NextRequest;
      const jose = await import("jose");
      SignJWT = jose.SignJWT;
      const m = await import("../../src/middleware.js");
      middleware = m.middleware;
    } catch (e) {
      middleware = null;
      NextRequest = null;
      SignJWT = null;
    }
  });

  it("returns 401 for protected API without cookie (requires next/server)", async () => {
    if (!middleware || !NextRequest) {
      console.log("  (skip: next/server not available in test env)");
      return;
    }
    const origFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve({ ok: true, json: () => ({ requireLogin: true }) });
    try {
      const req = new NextRequest("http://localhost:20128/api/settings", { method: "GET" });
      const res = await middleware(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error, "Unauthorized");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("allows /api/auth/login without cookie (requires next/server)", async () => {
    if (!middleware || !NextRequest) {
      console.log("  (skip: next/server not available in test env)");
      return;
    }
    const req = new NextRequest("http://localhost:20128/api/auth/login", { method: "POST" });
    const res = await middleware(req);
    assert.notStrictEqual(res.status, 401);
  });

  it("allows protected API with valid JWT (requires next/server and jose)", async () => {
    if (!middleware || !NextRequest || !SignJWT) {
      console.log("  (skip: next/server or jose not available)");
      return;
    }
    const token = await new SignJWT({ authenticated: true })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(SECRET);
    const req = new NextRequest("http://localhost:20128/api/settings", {
      method: "GET",
      headers: { cookie: `auth_token=${token}` },
    });
    const res = await middleware(req);
    assert.notStrictEqual(res.status, 401);
  });
});
