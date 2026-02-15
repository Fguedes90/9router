# 9Router — Project Knowledge Base

**Generated:** 2026-02-15 · **Commit:** 292311a · **Branch:** master

## Overview

AI routing gateway + dashboard. Next.js 16 app that exposes an OpenAI-compatible `/v1/*` endpoint, translates between provider formats (OpenAI ↔ Claude ↔ Gemini ↔ Kiro ↔ Cursor), and falls back across subscription → cheap → free tiers automatically. JavaScript/ESM only — no TypeScript.

## Structure

```
9router/
├── src/                  # Next.js app (dashboard UI + API routes + SSE handler)
│   ├── app/              # Next.js App Router pages + API routes
│   │   ├── api/          # 19 route domains (v1, oauth, providers, sync, etc.)
│   │   ├── (dashboard)/  # Dashboard pages (route group with shared layout)
│   │   └── landing/      # Landing page
│   ├── lib/              # Server-side: DB, OAuth services, middleware
│   ├── shared/           # Client+server: components, constants, utils, hooks
│   ├── sse/              # App-level chat handler (calls into open-sse)
│   ├── store/            # Zustand stores (provider, theme, user)
│   └── models/           # Model definitions
├── open-sse/             # Core routing engine (see open-sse/AGENTS.md)
├── cloud/                # Cloudflare Worker mirror (see cloud/AGENTS.md)
├── tests/security/       # Node.js native test runner tests
├── tester/               # Manual validation scripts (security, translator)
├── docs/                 # ARCHITECTURE.md, CURSOR_MODELS.md
├── scripts/              # Dev helper scripts
└── public/providers/     # Provider logo assets (27 PNGs)
```

## Where to Look

| Task | Location | Notes |
|------|----------|-------|
| Add/modify API route | `src/app/api/{domain}/route.js` | Next.js App Router convention |
| Add AI provider | `src/lib/oauth/services/{provider}.js` + `open-sse/executors/{provider}.js` + `open-sse/config/providerModels.js` | Strategy pattern per provider |
| Add format translation | `open-sse/translator/request/` + `open-sse/translator/response/` | Register in `open-sse/translator/index.js` |
| Modify routing/fallback | `src/sse/handlers/chat.js` (app glue) → `open-sse/handlers/chatCore.js` (core) | Chat handler is the entry; chatCore is the pipeline |
| Dashboard UI | `src/app/(dashboard)/dashboard/{section}/` | Each section has own `page.js` + `components/` |
| Shared UI components | `src/shared/components/` | Barrel export via `index.js` |
| Model pricing data | `src/shared/constants/pricing.js` | Static object, 800+ lines |
| Provider constants | `src/shared/constants/providers.js` + `open-sse/config/providerModels.js` | Frontend vs engine configs |
| Database operations | `src/lib/localDb.js` (config) · `src/lib/usageDb.js` (usage) | LowDB JSON + SQLite for request details |
| Cloud sync | `src/app/api/sync/cloud/route.js` → `src/shared/services/cloudSyncScheduler.js` | Periodic push to CF Worker |
| CLI tool integrations | `src/app/api/cli-tools/` | Config writers for Claude/Codex/OpenClaw/OpenCode |
| Security middleware | `src/lib/middlewareAuth.js` · `src/proxy.js` | JWT cookie auth + API key verification |

## Request Lifecycle

```
Client POST /v1/chat/completions
  → next.config.mjs rewrite → /api/v1/chat/completions
  → src/sse/handlers/chat.js (resolve model/combo, select account)
  → open-sse/handlers/chatCore.js (detect format, translate, execute)
  → open-sse/executors/{provider}.js (upstream call)
  → open-sse/translator/response/* (translate stream back)
  → src/lib/usageDb.js (record usage)
  → SSE/JSON response to client
```

## Conventions

- **ESM everywhere** — `.js` with `import/export`, config files use `.mjs`
- **No TypeScript** — `jsconfig.json` for path aliases (`@/` → `src/`)
- **Path alias** — `@/shared/components`, `@/lib/localDb`, etc.
- **Barrel exports** — `index.js` in shared/components, shared/utils, shared/hooks, open-sse root
- **React 19** + **Tailwind CSS 4** (PostCSS plugin, no `tailwind.config.js`)
- **Zustand** for client state (`src/store/`)
- **Native `node:test`** runner — `node --test tests/**/*.test.js`
- **OpenAI as lingua franca** — all translations go through OpenAI intermediate format
- **Provider strategy pattern** — each OAuth provider is a class in `src/lib/oauth/services/`
- **Executor inheritance** — `BaseExecutor` in `open-sse/executors/base.js`, subclasses override `buildUrl()`, `buildHeaders()`, `refreshCredentials()`
- **Next.js `--webpack` flag** — forced over Turbopack in dev and build

## Anti-Patterns (This Project)

- **Never hardcode API keys** in source — env vars or DB only
- **`usageDb` ignores `DATA_DIR`** — always writes to `~/.9router/` (known architectural debt)
- **`openai-to-kiro.old.js`** exists in translator/request — dead code, do not reference
- **Log directory is sensitive** when `ENABLE_REQUEST_LOGS=true` — contains full headers/bodies
- **Default `JWT_SECRET` and `INITIAL_PASSWORD`** must be changed in production

## Commands

```bash
npm run dev          # Next.js dev on port 20128 (--webpack)
npm run build        # Production build (standalone output)
npm run start        # Start production server
npm test             # node --test tests/**/*.test.js
npm run test:security # Security tests only

# Docker
docker build -t 9router .
docker run -d -p 20128:20128 --env-file .env -v 9router-data:/app/data 9router

# Cloud Worker (cd cloud/)
npm run deploy       # wrangler deploy
```

## Environment Variables (Key)

| Variable | Default | Critical |
|----------|---------|----------|
| `JWT_SECRET` | `9router-default-secret-change-me` | **Change in prod** |
| `INITIAL_PASSWORD` | `123456` | **Change in prod** |
| `DATA_DIR` | `~/.9router` | Main DB location |
| `API_KEY_SECRET` | `endpoint-proxy-api-key-secret` | HMAC for API keys |
| `PORT` | framework default | Use `20128` |
| `ENABLE_REQUEST_LOGS` | `false` | Sensitive when enabled |

## Notes

- `open-sse/` is shared between local app and cloud worker via `file:../open-sse` dependency
- Cloud worker uses D1 (SQL) + KV; local app uses LowDB (JSON) + SQLite
- Provider logos live in `public/providers/` — filename must match provider ID
- `tester/` is separate from `tests/` — manual validation scripts, not automated suite
- Existing `docs/ARCHITECTURE.md` has full Mermaid diagrams for request lifecycle, fallback flow, OAuth flow, cloud sync, and data model
