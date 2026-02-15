# v0.2.81 (2026-02-15)

## Features
- Added middleware for `/api/*` route protection: JWT required on sensitive routes; public prefixes for login, logout, require-login, `/api/v1/*`, `/api/cloud/auth`.
- Added OAuth `redirect_uri` validation via `getAllowedRedirectUri`: only same-origin or localhost/127.0.0.1 with path `/callback`.
- Added settings allowlist (`filterAllowedSettings`) for PATCH `/api/settings` to prevent mass assignment.
- Added `validateBaseUrlForFetch` for provider-nodes validate: HTTPS only, block localhost and private IPs (SSRF mitigation).
- Cloud worker: forward and forward-raw require `X-Forward-Secret` (FORWARD_SECRET); sync endpoints support `X-Sync-Secret` when SYNC_SECRET is set; CORS configurable via ALLOWED_ORIGINS.
- Added security tests in `tests/security/` (redirectUri, settingsAllowlist, middleware); run with `npm run test:security`.

## Fixes
- Fixed unauthenticated access to API routes: middleware now enforces JWT on `/api/settings`, `/api/shutdown`, `/api/sync/cloud`, etc.
- Fixed OAuth open redirect: reject client-supplied `redirect_uri` to external or non-callback paths.
- Fixed sync/cloud writing base URL from request `Host` header (poisoning risk): now uses `NEXT_PUBLIC_BASE_URL` / `BASE_URL` / localhost.
- Fixed default credentials in production: login and middleware return 503 if `JWT_SECRET` is default or unset; production rejects "123456" as current password when changing.
- Fixed Cloud worker SSRF: forward/forward-raw validate target URL (HTTPS only, no private IPs).
- Fixed Cloud worker sync auth: when SYNC_SECRET is set, require `X-Sync-Secret` header.
- Removed broken `/testClaude` route and import from Cloud worker (missing handler module).
- Cloud worker API key verification now uses `env.API_KEY_SECRET` when set; legacy fallback for compatibility. Documented in `.env.example`.

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
