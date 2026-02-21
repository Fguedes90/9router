# Throughput Monitoring System

## TL;DR

> **Quick Summary**: Implement a throughput monitoring system that calculates tokens/second for each provider/model, correlates performance with input/output token amounts, and provides analytics API with percentiles for provider comparison.
> 
> **Deliverables**:
> - Extended request_details table with throughput metrics
> - New `/api/analytics/throughput` endpoint with percentiles
> - Dashboard page with performance heatmap and tables
> - Performance recommendations engine
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Schema migration → Data capture → Analytics API → Dashboard UI

---

## Context

### Original Request
Implement throughput monitoring to track tokens/s performance for each model of each provider. Count from request start to response finish. Correlate performance with input/output token amounts. Enable provider comparison for use case optimization.

### Interview Summary
**Key Discussions**:
- Current architecture captures latency (`ttft`, `total`) and tokens but lacks derived metrics
- `stream.js` captures `ttftAt` but NOT `lastChunkAt` - critical gap for streaming throughput
- Current 1000 record limit is too low for meaningful analytics (need ~100+ samples for percentiles)
- Two storage strategies: pre-calculate (faster reads) vs on-demand (simpler writes)

**Research Findings**:
- `chatCore.js` tracks `requestStartTime` at line 352 and calculates total latency
- `stream.js` captures `ttftAt` on first chunk (lines 57-63)
- `requestDetailsDb.js` uses SQLite with WAL mode and batch writes
- Existing indexes: timestamp, provider, model, connection_id, status
- Cloud Worker has mock DB - analytics may not work until D1 migration

### Metis Review
**Critical Gaps Identified**:
1. **Missing `lastChunkAt` timestamp** - cannot calculate true streaming throughput without it
2. **Record limit too low** - 1000 records insufficient for percentile calculations
3. **No throughput definition** - output tokens/sec vs total tokens/sec must be decided
4. **No pre-calculation strategy** - percentiles on every query will be slow

**Addressed by**:
- Adding `lastChunkAt` capture in `stream.js` flush() method
- Increasing `OBSERVABILITY_MAX_RECORDS` default to 10,000
- Pre-calculating throughput at write-time
- Adding background aggregation for percentiles

---

## Work Objectives

### Core Objective
Provide real-time and historical throughput analytics to help users choose the best provider for their use case based on input/output token patterns.

### Concrete Deliverables
- `throughput_tokens_per_sec` column in request_details table
- `output_duration_ms` column for streaming-specific duration
- `/api/analytics/throughput` endpoint with filtering and percentiles
- `/dashboard/analytics` page with performance comparison UI
- Compound index `(provider, model, timestamp)` for efficient queries

### Definition of Done
- [ ] All new requests have throughput metrics calculated
- [ ] Analytics API returns percentiles (p50, p95, p99) in <500ms
- [ ] Dashboard displays heatmap of provider/model performance
- [ ] Recommendations engine suggests best provider per input size

### Must Have
- Throughput calculation for both streaming and non-streaming requests
- At least p50, p95, p99 percentile support
- Filtering by provider, model, date range
- Input token category correlation (low/medium/high)

### Must NOT Have (Guardrails)
- Real-time WebSocket updates (scope creep - use polling)
- Alerting/notification system (separate feature)
- CSV/JSON export functionality (separate feature)
- Custom unbounded date ranges (max 30 days)
- Modifications to existing latency/tokens columns (add only)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (node:test runner)
- **Automated tests**: YES (TDD)
- **Framework**: node:test (native)
- **TDD**: Each task follows RED → GREEN → REFACTOR

### QA Policy
Every task includes agent-executed QA scenarios with evidence capture.

- **API**: Use Bash (curl) - Send requests, assert status + response fields
- **Database**: Use Bash (sqlite3) - Query tables, assert columns exist
- **UI**: Use Playwright - Navigate, interact, assert DOM

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - 4 parallel):
├── Task 1: Schema migration - add throughput columns [quick]
├── Task 2: Add lastChunkAt capture in stream.js [quick]
├── Task 3: Update OBSERVABILITY_MAX_RECORDS default [quick]
└── Task 4: Create throughput calculation utility [quick]

Wave 2 (Core Logic - 3 parallel, depends Wave 1):
├── Task 5: Integrate throughput calc in chatCore.js [unspecified-high]
├── Task 6: Add compound index for analytics queries [quick]
└── Task 7: Create percentile calculation service [deep]

Wave 3 (API Layer - 3 parallel, depends Wave 2):
├── Task 8: Build /api/analytics/throughput endpoint [unspecified-high]
├── Task 9: Add aggregation background job [unspecified-high]
└── Task 10: Create recommendations engine [deep]

Wave 4 (UI Layer - 2 parallel, depends Wave 3):
├── Task 11: Build analytics dashboard page [visual-engineering]
└── Task 12: Add performance heatmap component [visual-engineering]

Wave FINAL (Verification - 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 5 → Task 8 → Task 11 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Waves 1 & 2)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|------------|--------|
| 1 | - | 5, 6 |
| 2 | - | 5 |
| 3 | - | - |
| 4 | - | 5 |
| 5 | 1, 2, 4 | 8 |
| 6 | 1 | 8 |
| 7 | - | 8, 10 |
| 8 | 5, 6, 7 | 11, 12 |
| 9 | 5 | - |
| 10 | 7 | 11 |
| 11 | 8, 10 | - |
| 12 | 8 | - |
| F1-F4 | All | - |

### Agent Dispatch Summary

- **Wave 1**: 4 × `quick`
- **Wave 2**: 1 × `quick`, 1 × `unspecified-high`, 1 × `deep`
- **Wave 3**: 2 × `unspecified-high`, 1 × `deep`
- **Wave 4**: 2 × `visual-engineering`
- **Final**: 1 × `oracle`, 3 × `unspecified-high`/`deep`

---

## TODOs

### Wave 1: Foundation

- [ ] 1. Schema Migration - Add Throughput Columns

  **What to do**:
  - Add new columns to `request_details` table in `requestDetailsDb.js`:
    - `throughput_tokens_per_sec REAL` - tokens per second
    - `output_duration_ms INTEGER` - time from first to last token (streaming)
    - `input_category TEXT` - low/medium/high based on prompt_tokens
    - `output_category TEXT` - short/medium/long based on completion_tokens
  - Write migration logic to handle existing DB (ALTER TABLE)
  - Update INSERT statement to include new columns

  **Must NOT do**:
  - Modify existing columns (latency, tokens)
  - Drop/recreate table (preserve data)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file schema change with clear pattern
  - **Skills**: []
    - No special skills needed - straightforward DB migration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: None

  **References**:
  - `src/lib/requestDetailsDb.js:155-169` - Table creation, column structure
  - `src/lib/requestDetailsDb.js:228-233` - INSERT statement pattern
  - SQLite docs: https://www.sqlite.org/lang_altertable.html

  **Acceptance Criteria**:
  - [ ] Test file created: tests/analytics/schema.test.js
  - [ ] node --test tests/analytics/schema.test.js → PASS
  - [ ] New columns exist in SQLite schema

  **QA Scenarios**:
  ```
  Scenario: Schema migration adds new columns
    Tool: Bash (sqlite3)
    Preconditions: Fresh database or existing database
    Steps:
      1. Run the app once to trigger DB initialization
      2. sqlite3 ~/.9router/request-details.sqlite ".schema request_details"
      3. Assert output contains 'throughput_tokens_per_sec REAL'
      4. Assert output contains 'output_duration_ms INTEGER'
      5. Assert output contains 'input_category TEXT'
      6. Assert output contains 'output_category TEXT'
    Expected Result: All 4 new columns present in schema
    Evidence: .sisyphus/evidence/task-1-schema-migration.txt

  Scenario: Existing data preserved after migration
    Tool: Bash (sqlite3)
    Preconditions: Database with existing records
    Steps:
      1. Count records before migration: sqlite3 ~/.9router/request-details.sqlite "SELECT COUNT(*) FROM request_details"
      2. Restart app to trigger migration
      3. Count records after migration
      4. Assert counts match
    Expected Result: No data loss
    Evidence: .sisyphus/evidence/task-1-data-preserved.txt
  ```

  **Commit**: YES (Wave 1)
  - Message: `feat(analytics): add throughput columns to request_details schema`
  - Files: `src/lib/requestDetailsDb.js`, `tests/analytics/schema.test.js`

---

- [ ] 2. Add lastChunkAt Capture in stream.js

  **What to do**:
  - Modify `stream.js` to capture timestamp when stream completes:
    - Add `lastChunkAt` variable in `createSSEStream()`
    - Set `lastChunkAt = Date.now()` in `flush()` method
    - Pass `lastChunkAt` to `onStreamComplete` callback
  - Update `onStreamComplete` signature to accept fourth parameter
  - Update all callers of `onStreamComplete` throughout codebase

  **Must NOT do**:
  - Change streaming behavior (only add measurement)
  - Modify how chunks are processed

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file change, clear scope
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `open-sse/utils/stream.js:57-63` - `ttftAt` capture pattern to follow
  - `open-sse/utils/stream.js:230-327` - `flush()` method to modify
  - `open-sse/utils/stream.js:256-262` - `onStreamComplete` call in PASSTHROUGH mode
  - `open-sse/utils/stream.js:318-323` - `onStreamComplete` call in TRANSLATE mode

  **Acceptance Criteria**:
  - [ ] `lastChunkAt` captured in both PASSTHROUGH and TRANSLATE modes
  - [ ] `onStreamComplete` receives `lastChunkAt` as 4th parameter
  - [ ] Test file: tests/analytics/stream-timing.test.js → PASS

  **QA Scenarios**:
  ```
  Scenario: lastChunkAt captured in streaming response
    Tool: Bash (curl + node)
    Preconditions: App running, valid API key
    Steps:
      1. Make streaming request to /v1/chat/completions
      2. Query request_details: sqlite3 ~/.9router/request-details.sqlite "SELECT latency FROM request_details ORDER BY timestamp DESC LIMIT 1"
      3. Parse JSON and check for output_duration_ms field
    Expected Result: output_duration_ms > 0 for streaming requests
    Evidence: .sisyphus/evidence/task-2-streaming-capture.json

  Scenario: ttftAt and lastChunkAt differ for multi-chunk streams
    Tool: Bash (curl)
    Preconditions: App running, streaming request with >1 chunk
    Steps:
      1. Make streaming request with long response (prompt: "write a poem")
      2. Wait for completion
      3. Query request_details for output_duration_ms
      4. Assert output_duration_ms > ttft
    Expected Result: output_duration_ms > 0, different from ttft
    Evidence: .sisyphus/evidence/task-2-timing-diff.json
  ```

  **Commit**: YES (Wave 1)
  - Message: `feat(analytics): capture lastChunkAt for streaming throughput`
  - Files: `open-sse/utils/stream.js`, `tests/analytics/stream-timing.test.js`

---

- [ ] 3. Update OBSERVABILITY_MAX_RECORDS Default

  **What to do**:
  - Change default value from 1000 to 10000 in requestDetailsDb.js
  - Update environment variable fallback

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 1 (with Tasks 1, 2, 4), Blocks: None

  **Commit**: YES (Wave 1)

---

- [ ] 4. Create Throughput Calculation Utility

  **What to do**:
  - Create new utility file: open-sse/utils/throughputCalc.js
  - Export functions for throughput calculation and token categorization

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 1 (with Tasks 1, 2, 3), Blocks: Task 5

  **Commit**: YES (Wave 1)

---

### Wave 2: Core Logic

- [ ] 5. Integrate Throughput Calculation in chatCore.js

  **What to do**:
  - Import throughput utility in chatCore.js
  - Calculate throughput for streaming and non-streaming requests
  - Pass metrics to saveRequestDetail()

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Sequential, Blocked by: Tasks 1, 2, 4, Blocks: Tasks 8, 9

  **Commit**: YES (Wave 2)

---

- [ ] 6. Add Compound Index for Analytics Queries

  **What to do**:
  - Add compound index on (provider, model, timestamp)

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 2 (with Tasks 5, 7), Blocked by: Task 1

  **Commit**: YES (Wave 2)

---

- [ ] 7. Create Percentile Calculation Service

  **What to do**:
  - Create src/lib/analytics/percentileService.js
  - Implement p50, p95, p99 calculation with caching

  **Recommended Agent Profile**: `deep`

  **Parallelization**: Wave 2 (with Tasks 5, 6), Blocks: Tasks 8, 10

  **Commit**: YES (Wave 2)

---

### Wave 3: API Layer

- [ ] 8. Build /api/analytics/throughput Endpoint

  **What to do**:
  - Create src/app/api/analytics/throughput/route.js
  - Implement GET endpoint with filtering and percentiles
  - Add 30-day max date range validation

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 3 (with Tasks 9, 10), Blocked by: Tasks 5, 6, 7, Blocks: Tasks 11, 12

  **Commit**: YES (Wave 3)

---

- [ ] 9. Add Aggregation Background Job

  **What to do**:
  - Create src/lib/analytics/aggregationJob.js
  - Pre-calculate hourly aggregations and percentiles

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 3 (with Tasks 8, 10)

  **Commit**: YES (Wave 3)

---

- [ ] 10. Create Recommendations Engine

  **What to do**:
  - Create src/lib/analytics/recommendations.js
  - Generate provider recommendations based on token patterns

  **Recommended Agent Profile**: `deep`

  **Parallelization**: Wave 3 (with Tasks 8, 9), Blocked by: Task 7

  **Commit**: YES (Wave 3)

---

### Wave 4: UI Layer

- [ ] 11. Build Analytics Dashboard Page

  **What to do**:
  - Create src/app/(dashboard)/dashboard/analytics/page.js
  - Display throughput metrics with filtering

  **Recommended Agent Profile**: `visual-engineering`
  **Skills**: [`frontend-ui-ux`]

  **Parallelization**: Wave 4 (with Task 12), Blocked by: Tasks 8, 10

  **Commit**: YES (Wave 4)

---

- [ ] 12. Add Performance Heatmap Component

  **What to do**:
  - Create src/shared/components/PerformanceHeatmap.js
  - Visualize provider/model performance by input size

  **Recommended Agent Profile**: `visual-engineering`
  **Skills**: [`frontend-ui-ux`]

  **Parallelization**: Wave 4 (with Task 11), Blocked by: Task 8

  **Commit**: YES (Wave 4)

---

## Final Verification Wave (MANDATORY)

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify all "Must Have" implemented, all "Must NOT Have" absent. Check evidence files exist.

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review for anti-patterns.

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` if UI)
  Execute all QA scenarios, capture evidence, test edge cases.

- [ ] F4. **Scope Fidelity Check** — `deep`
  Verify 1:1 mapping between spec and implementation. No scope creep.

---

## Commit Strategy

- **Wave 1**: `feat(analytics): add throughput schema and capture foundation`
- **Wave 2**: `feat(analytics): integrate throughput calculation in request flow`
- **Wave 3**: `feat(analytics): add throughput analytics API and recommendations`
- **Wave 4**: `feat(dashboard): add performance analytics page`

---

## Success Criteria

### Verification Commands
```bash
# 1. Verify throughput column exists
curl -s "http://localhost:20128/api/usage/request-details?pageSize=1" \
  | jq -e '.details[0].throughput_tokens_per_sec | numbers'

# 2. Verify analytics endpoint
curl -s "http://localhost:20128/api/analytics/throughput" \
  | jq -e '.data | length >= 0'

# 3. Verify percentiles
curl -s "http://localhost:20128/api/analytics/throughput?percentiles=p50,p95,p99" \
  | jq -e '.percentiles.p50 != null'

# 4. Performance benchmark
time curl -s "http://localhost:20128/api/analytics/throughput" > /dev/null
# Assert: completes in <500ms

# 5. Verify dashboard loads
curl -s "http://localhost:20128/dashboard/analytics" | grep -q "analytics"
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Analytics API responds in <500ms
- [ ] Dashboard renders performance data
