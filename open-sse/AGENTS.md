# open-sse — Core Routing Engine

AI request routing, format translation, and provider execution library. Shared by local app (`src/`) and cloud worker (`cloud/`).

## Structure

```
open-sse/
├── index.js              # Barrel export (public API)
├── handlers/
│   ├── chatCore.js       # Main pipeline: detect → translate → execute → stream
│   └── responsesHandler.js
├── executors/            # Provider network adapters (inherit BaseExecutor)
│   ├── base.js           # Abstract base: execute(), buildUrl(), buildHeaders()
│   ├── default.js        # Generic OpenAI-compatible executor
│   ├── codex.js          # OpenAI Codex specifics
│   ├── cursor.js         # Cursor: HTTP2, protobuf, checksums
│   ├── gemini-cli.js     # Google Gemini CLI auth
│   ├── github.js         # GitHub Copilot
│   ├── iflow.js          # iFlow free provider
│   ├── kiro.js           # Kiro (AWS)
│   └── antigravity.js    # Antigravity provider
├── translator/           # Format conversion registry
│   ├── index.js          # Registry init + translateRequest/translateResponse
│   ├── formats.js        # Format constants
│   ├── request/          # Source→OpenAI→Target request converters
│   └── response/         # Provider→OpenAI→Client response converters
├── services/             # Business logic
│   ├── model.js          # Parse "prefix/model" strings
│   ├── provider.js       # Detect source format, build provider config
│   ├── accountFallback.js # Error classification + cooldown logic
│   ├── tokenRefresh.js   # OAuth token lifecycle (647 lines, complex)
│   ├── combo.js          # Multi-model fallback lists
│   ├── compact.js        # Message compaction
│   └── usage.js          # Upstream usage scraping (GitHub, Google quotas)
├── config/               # Static configuration
│   ├── providerModels.js # Model registry (IDs, token limits, capabilities)
│   ├── constants.js      # Shared constants
│   └── ollamaModels.js   # Ollama model mappings
└── utils/                # Cross-cutting helpers
    ├── stream.js          # SSE stream controller
    ├── streamHandler.js   # Stream chunk processing
    ├── proxyFetch.js      # HTTP/SOCKS proxy support
    ├── usageTracking.js   # Token extraction from responses
    ├── cursorProtobuf.js  # ConnectRPC protobuf encoder/decoder (596 lines)
    ├── cursorChecksum.js  # Cursor request signing
    ├── requestLogger.js   # 3-stage debug logging
    └── error.js           # Error normalization
```

## Where to Look

| Task | File(s) |
|------|---------|
| Add new provider executor | Create `executors/{name}.js` extending `BaseExecutor`, register in `executors/index.js` |
| Add format translation | Add files in `translator/request/` and `translator/response/`, register in `translator/index.js` |
| Modify fallback behavior | `services/accountFallback.js` — error classification and cooldown |
| Debug request flow | Enable `ENABLE_REQUEST_LOGS=true`, check `requestLogger.js` 3-stage output |
| Add model definitions | `config/providerModels.js` |
| Modify stream handling | `utils/stream.js` (controller) + `utils/streamHandler.js` (chunk processing) |

## Conventions

- **OpenAI intermediate format** — all non-OpenAI requests translate to OpenAI first, then to target. Responses reverse this
- **Registry pattern** — translator uses `Map` registries, not switch statements. Lazy-initialized via `ensureInitialized()`
- **Executor inheritance** — override `buildUrl()`, `buildHeaders()`, `refreshCredentials()` on `BaseExecutor`. Call `super.execute()` for the request loop
- **`_openaiIntermediate`** property on responses — used for consistent logging across all translation paths
- **No database imports** — this module receives credentials/config as arguments, never imports DB directly (except `usageTracking` → `usageDb` for recording)

## Anti-Patterns

- Do not add database dependencies here — keep provider-agnostic
- `openai-to-kiro.old.js` is dead code — do not import
- `chatCore.js` (939 lines) is the highest-risk file for regressions — test changes carefully
- `cursorProtobuf.js` and `cursorChecksum.js` are reverse-engineered — document any protocol changes
