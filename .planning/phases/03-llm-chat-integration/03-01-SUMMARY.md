---
phase: 03-llm-chat-integration
plan: 01
subsystem: api
tags: [litellm, openrouter, cerebras, llm, chat, sqlite, fastapi, structured-output]

# Dependency graph
requires:
  - phase: 02-database-app-foundation
    provides: chat_messages table, get_db_path, init_db, app.state singletons
  - phase: 02-portfolio-trading-api
    provides: record_portfolio_snapshot function, trade execution DB patterns

provides:
  - POST /api/chat route handler with full LLM pipeline
  - litellm dependency in backend
  - LLM_MOCK=true deterministic testing mode
  - Auto-execution of LLM-triggered trades and watchlist changes
  - Conversation history persistence in chat_messages

affects: [frontend, 03-02-plan, e2e-testing]

# Tech tracking
tech-stack:
  added: [litellm>=1.84.0, openai, aiohttp, tiktoken, tokenizers]
  patterns:
    - Always-200 chat endpoint with LLM fallback (D-01)
    - Best-effort trade execution with actions_log collection (D-04)
    - Structured LLM output via Pydantic model_validate_json
    - Mock mode via LLM_MOCK env var for deterministic E2E tests

key-files:
  created:
    - backend/app/api/chat.py
  modified:
    - backend/pyproject.toml
    - backend/uv.lock

key-decisions:
  - "POST /api/chat always returns HTTP 200 — LLM failures return fallback message, no HTTPException"
  - "LLM_MOCK=true skips litellm call but still executes trades/watchlist changes and persists messages"
  - "Trade execution in chat replicates portfolio.py DB logic inline with BEGIN IMMEDIATE"
  - "One portfolio snapshot after all trades, not per-trade (D-05)"
  - "Last 20 chat_messages included as conversation history (hard cap, no token counting)"
  - "User message persisted before LLM call; assistant message after with actions JSON"

patterns-established:
  - "Chat handler: async def required for await state.market_source calls"
  - "LiteLLM structured output: completion(model=MODEL, response_format=LLMResponse, reasoning_effort=low, extra_body=EXTRA_BODY)"
  - "actions_log: collect error strings instead of raising HTTPException in chat context"

requirements-completed: [API-07, LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06]

# Metrics
duration: 15min
completed: 2026-05-15
---

# Phase 3 Plan 01: LLM Chat Integration — Backend Chat Endpoint Summary

**POST /api/chat with LiteLLM/Cerebras structured output, auto-executing LLM-triggered trades and watchlist changes via OpenRouter with full conversation history and always-200 HTTP contract**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-15T00:00:00Z
- **Completed:** 2026-05-15T00:15:00Z
- **Tasks:** 2
- **Files modified:** 3 (chat.py created, pyproject.toml + uv.lock updated)

## Accomplishments

- Added litellm dependency via `uv add litellm` (v1.84.0)
- Implemented complete POST /api/chat pipeline: mock detection, user message persistence, conversation history loading, system prompt with live portfolio context, LiteLLM structured output call, best-effort trade execution with transaction isolation, watchlist change execution, portfolio snapshot, assistant message persistence
- LLM_MOCK=true mode exercises all code paths (executes mock trade + watchlist change, persists messages) without calling OpenRouter

## Task Commits

1. **Task 1: Add litellm dependency** - `85a3114` (chore)
2. **Task 2: Implement backend/app/api/chat.py** - `038c17b` (feat)

## Files Created/Modified

- `backend/app/api/chat.py` - Complete POST /chat route handler with LLM pipeline (319 lines)
- `backend/pyproject.toml` - litellm>=1.84.0 added to dependencies
- `backend/uv.lock` - Updated lockfile with litellm and 34 transitive dependencies

## Decisions Made

- async def handler (not sync def) because watchlist changes need `await state.market_source.add_ticker/remove_ticker`
- Mock mode parses the fixed response into LLMResponse then runs through the full execution + persistence path — all code paths exercised in E2E tests
- History query uses LIMIT 20 with `ORDER BY created_at ASC` — most recent 20 messages in chronological order for LLM context
- actions_log strings appended to result.message so frontend users see what was executed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required beyond the OPENROUTER_API_KEY already in .env (used at request time, not at startup).

## Next Phase Readiness

- chat.py router is ready for registration in main.py (Plan 02 task)
- All LLM pipeline logic complete: mock mode, context building, structured output, trade + watchlist execution, persistence
- Plan 02 registers the router and any remaining wiring (e.g., main.py include_router call per D-08)

## Threat Surface Scan

All mitigations from the threat register implemented:
- T-03-01/T-03-02: Cash and shares validation inside BEGIN IMMEDIATE transaction for every LLM-triggered trade
- T-03-05: All LLM exceptions caught; handler always returns 200
- T-03-06: All DB writes use parameterized queries (sqlite3 ? placeholders); ticker uppercased and stripped

No new threat surface introduced beyond what is documented in the plan's threat model.

## Self-Check: PASSED

- `backend/app/api/chat.py` exists and imports cleanly
- `backend/pyproject.toml` contains litellm>=1.84.0
- Commits 85a3114 and 038c17b confirmed in git log

---
*Phase: 03-llm-chat-integration*
*Completed: 2026-05-15*
