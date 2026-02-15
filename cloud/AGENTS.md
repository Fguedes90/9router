# cloud — Cloudflare Worker Edge Proxy

Multi-tenant edge proxy that mirrors local 9Router config to Cloudflare. Users sync providers/keys/combos from local app, then use the Worker URL as their AI endpoint from anywhere.

## Structure

```
cloud/
├── src/
│   ├── index.js          # Worker entry: URL router, CORS, path normalization
│   ├── handlers/
│   │   ├── chat.js       # AI proxy (uses open-sse core)
│   │   ├── sync.js       # Config sync protocol (local ↔ cloud)
│   │   ├── forward.js    # Authenticated request forwarding
│   │   ├── forwardRaw.js # Raw passthrough forwarding
│   │   ├── verify.js     # Endpoint health check
│   │   ├── cache.js      # KV cache management
│   │   ├── cleanup.js    # CRON: prune stale machine data
│   │   └── countTokens.js
│   ├── services/
│   │   ├── storage.js    # D1 database layer (machines table)
│   │   ├── tokenRefresh.js
│   │   └── landingPage.js
│   ├── stubs/
│   │   └── usageDb.js    # No-op stub (workers can't write local files)
│   └── utils/
│       ├── forwardAuth.js # API key → machineId resolution
│       ├── auth.js
│       └── cors.js
├── migrations/           # D1 SQL schema
├── wrangler.toml         # CF config: D1 binding, KV namespace, module aliases
└── package.json          # Depends on open-sse via file:../open-sse
```

## Where to Look

| Task | File(s) |
|------|---------|
| Modify sync protocol | `handlers/sync.js` — merges by `updatedAt` timestamp |
| Debug auth failures | `utils/forwardAuth.js` — API key parsing + machineId extraction |
| Change storage schema | `services/storage.js` + `migrations/` |
| Modify routing | `handlers/chat.js` — wraps `open-sse` chatCore |

## Conventions

- **Multi-tenancy via `machineId`** — all data keyed by stable installation ID
- **API key formats**: new `sk-{machineId}-{keyId}-{crc8}` (self-identifying) or legacy `sk-{random8}` (URL-based routing)
- **Shared engine** — imports `open-sse` directly (`file:../open-sse`). Routing/translation logic is identical to local app
- **Stubs** — `stubs/usageDb.js` no-ops the usage logger since Workers can't write to filesystem. Aliased via `wrangler.toml`
- **Sync protocol** — newer `updatedAt` wins during merge; local app gets back tokens refreshed on the edge
- **D1 + KV** — D1 for persistent config, KV for caching

## Anti-Patterns

- Do not add `node:fs` or Node.js-specific APIs — this runs on Cloudflare Workers runtime
- Do not duplicate routing logic — use `open-sse` shared module
- `stream=false` on cloud endpoint may fail with parse error when upstream returns SSE — known issue, use `stream=true`
