# Changelog — Security corrections by Francis

The following security fixes were applied after an internal audit. Some were already committed; others were completed later.

---

## Summary of fixes

| Item | Description | Status |
|------|-------------|--------|
| **/api/* routes** | Middleware requires JWT on protected routes; public: login, logout, require-login, /api/v1/*, /api/cloud/auth | ✅ Applied |
| **OAuth redirect_uri** | Validation in `getAllowedRedirectUri`: only same-origin or localhost/127.0.0.1 with path `/callback` | ✅ Applied |
| **Sync/cloud Host** | Base URL no longer from `Host` header; uses `NEXT_PUBLIC_BASE_URL` / `BASE_URL` / localhost | ✅ Applied |
| **PATCH /api/settings** | Allowlist in `filterAllowedSettings`; only allowed keys are applied (mass assignment mitigated) | ✅ Applied |
| **JWT_SECRET in production** | Login and middleware return 503 if `JWT_SECRET` is default or unset in production | ✅ Applied |
| **Password "123456"** | In production, "123456" is not accepted as current password when changing (forces changing default first) | ✅ Applied |
| **Cloud: /forward and /forward-raw** | Auth via `X-Forward-Secret` (FORWARD_SECRET); HTTPS only; block private IPs (SSRF) | ✅ Applied |
| **Cloud: /sync/:machineId** | When `SYNC_SECRET` is set, requires `X-Sync-Secret` header (app sends `CLOUD_SYNC_SECRET`) | ✅ Applied |
| **Provider-nodes validate** | `validateBaseUrlForFetch`: HTTPS only; block localhost and private IPs (SSRF) | ✅ Applied |
| **CORS on worker** | `ALLOWED_ORIGINS` on worker restricts origins; without env keeps `*` for compatibility | ✅ Applied |
| **testClaude on worker** | Route and import removed (missing module was breaking the worker) | ✅ Applied |
| **Cloud API_KEY_SECRET** | Worker uses `env.API_KEY_SECRET` when set; legacy fallback for compatibility | ✅ Applied |

---

## Files changed / created

- **`src/middleware.js`** — Protection of `/api/*` routes with JWT cookie verification; public prefix list.
- **`src/lib/oauth/utils/redirectUri.js`** — `getAllowedRedirectUri(origin, requestedRedirectUri)`.
- **`src/lib/settingsAllowlist.js`** — `ALLOWED_SETTINGS_KEYS` and `filterAllowedSettings(body)`.
- **`src/lib/validateBaseUrl.js`** — `validateBaseUrlForFetch(baseUrl)` (SSRF in provider-nodes).
- **`src/app/api/settings/route.js`** — Uses `filterAllowedSettings`; in production rejects "123456" as current.
- **`src/app/api/auth/login/route.js`** — In production requires non-default `JWT_SECRET`; 503 if misconfigured.
- **`src/app/api/sync/cloud/route.js`** — Base URL from env, not Host header.
- **`src/app/api/provider-nodes/validate/route.js`** — Validates `baseUrl` with `validateBaseUrlForFetch`.
- **`cloud/src/handlers/forward.js`**, **`cloud/src/handlers/forwardRaw.js`** — Auth and URL validation (`forwardAuth.js`).
- **`cloud/src/handlers/sync.js`** — Checks `X-Sync-Secret` when `SYNC_SECRET` is set.
- **`cloud/src/index.js`** — CORS via `ALLOWED_ORIGINS`; removal of `/testClaude`.
- **`cloud/src/utils/apiKey.js`** — `parseApiKey(apiKey, apiKeySecret)` uses `env.API_KEY_SECRET`.
- **`cloud/src/handlers/verify.js`**, **chat.js**, **cache.js** — Pass `env?.API_KEY_SECRET` to `parseApiKey`.
- **`tests/security/`** — Tests for redirectUri, settingsAllowlist, and middleware (path classification + integration).
- **`.env.example`** — Documentation for `API_KEY_SECRET` on the worker.

---

## Security tests

Run:

```bash
npm run test:security
```

Tests live in `tests/security/`.

---

# v0.2.66 (2026-02-06)

## Features
- Added Cursor provider end-to-end support, including OAuth import flow and translator/executor integration (`137f315`, `0a026c7`).
- Enhanced auth/settings flow with `requireLogin` control and `hasPassword` state handling in dashboard/login APIs (`249fc28`).
- Improved usage/quota UX with richer provider limit cards, new quota table, and clearer reset/countdown display (`32aefe5`).
- Added model support for custom providers in UI/combos/model selection (`a7a52be`).
- Expanded model/provider catalog:
  - Codex updates: GPT-5.3 support, translation fixes, thinking levels (`127475d`)
  - Added Claude Opus 4.6 model (`e8aa3e2`)
  - Added MiniMax Coding (CN) provider (`7c609d7`)
  - Added iFlow Kimi K2.5 model (`9e357a7`)
  - Updated CLI tools with Droid/OpenClaw cards and base URL visibility improvements (`a2122e3`)
- Added auto-validation for provider API keys when saving settings (`b275dfd`).
- Added Docker/runtime deployment docs and architecture documentation updates (`5e4a15b`).

## Fixes
- Improved local-network compatibility by allowing auth cookie flow over HTTP deployments (`0a394d0`).
- Improved Antigravity quota/stream handling and Droid CLI compatibility behavior (`3c65e0c`, `c612741`, `8c6e3b8`).
- Fixed GitHub Copilot model mapping/selection issues (`95fd950`).
- Hardened local DB behavior with corrupt JSON recovery and schema-shape migration safeguards (`e6ef852`).
- Fixed logout/login edge cases:
  - Prevent unintended auto-login after logout (`49df3dc`)
  - Avoid infinite loading on failed `/api/settings` responses (`01c9410`)

# v0.2.56 (2026-02-04)

## Features
- Added Anthropic-compatible provider support across providers API/UI flow (`da5bdef`).
- Added provider icons to dashboard provider pages/lists (`60bd686`, `8ceb8f2`).
- Enhanced usage tracking pipeline across response handlers/streams with buffered accounting improvements (`a33924b`, `df0e1d6`, `7881db8`).

## Fixes
- Fixed usage conversion and related provider limits presentation issues (`e6e44ac`).

# v0.2.52 (2026-02-02)

## Features
- Implemented Codex Cursor compatibility and Next.js 16 proxy migration updates (`e9b0a73`, `7b864a9`, `1c6dd6d`).
- Added OpenAI-compatible provider nodes with CRUD/validation/test coverage in API and UI (`0a28f9f`).
- Added token expiration and key-validity checks in provider test flow (`686585d`).
- Added Kiro token refresh support in shared token refresh service (`f2ca6f0`).
- Added non-streaming response translation support for multiple formats (`63f2da8`).
- Updated Kiro OAuth wiring and auth-related UI assets/components (`31cc79a`).

## Fixes
- Fixed cloud translation/request compatibility path (`c7219d0`).
- Fixed Kiro auth modal/flow issues (`85b7bb9`).
- Included Antigravity stability fixes in translator/executor flow (`2393771`, `8c37b39`).

# v0.2.43 (2026-01-27)

## Fixes
- Fixed CLI tools model selection behavior (`a015266`).
- Fixed Kiro translator request handling (`d3dd868`).

# v0.2.36 (2026-01-19)

## Features
- Added the Usage dashboard page and related usage stats components (`3804357`).
- Integrated outbound proxy support in Open SSE fetch pipeline (`0943387`).
- Improved OpenAI compatibility and build stability across endpoint/profile/providers flows (`d9b8e48`).

## Fixes
- Fixed combo fallback behavior (`e6ca119`).
- Resolved SonarQube findings, Next.js image warnings, and build/lint cleanups (`7058b06`, `0848dd5`).

# v0.2.31 (2026-01-18)

## Fixes
- Fixed Kiro token refresh and executor behavior (`6b22b1f`, `1d481c2`).
- Fixed Kiro request translation handling (`eff52f7`, `da15660`).

# v0.2.27 (2026-01-15)

## Features
- Added Kiro provider support with OAuth flow (`26b61e5`).

## Fixes
- Fixed Codex provider behavior (`26b61e5`).

# v0.2.21 (2026-01-12)

## Changes
- README updates.
- Antigravity bug fixes.
