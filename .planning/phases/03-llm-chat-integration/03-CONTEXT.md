# Phase 3: LLM Chat Integration - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the `POST /api/chat` endpoint: a single route that loads live portfolio context, builds a system prompt, calls Cerebras via LiteLLM/OpenRouter, parses structured JSON output, auto-executes trades and watchlist changes, persists conversation history in `chat_messages`, and returns the full structured response. Also implements `LLM_MOCK=true` mode for deterministic testing.

This is purely backend. Six requirements: API-07 and LLM-01 through LLM-06.

</domain>

<decisions>
## Implementation Decisions

### LLM Failure Handling
- **D-01:** `POST /api/chat` always returns HTTP 200. If the LLM call raises any exception (timeout, auth error, network failure), catch it and return a graceful fallback: `{"message": "I'm temporarily unavailable. Please try again.", "trades": [], "watchlist_changes": []}`. Chat UIs must never handle HTTP errors — consistent response shape regardless of backend state.
- **D-02:** If structured output parses successfully but contains fields outside the schema, ignore them. If `model_validate_json` fails (malformed JSON from LLM), treat as LLM failure and return the same fallback message (D-01 path).

### Conversation History
- **D-03:** Include the last 20 messages from `chat_messages` (ordered by `created_at ASC`, fetch `LIMIT 20` before the new user message). No token counting — 20 messages is a hard cap. Query: `SELECT role, content FROM chat_messages WHERE user_id='default' ORDER BY created_at ASC LIMIT 20`.

### Trade and Watchlist Auto-Execution
- **D-04:** Best-effort execution — process each trade in `trades[]` independently. For each: call the same DB logic as `POST /api/portfolio/trade` (same validation: cash check, shares check, price check). Collect a list of result strings (success or error message). Do the same for `watchlist_changes[]`. Append all results to the LLM's `message` field so the user sees what happened.
- **D-05:** After all trades execute, call `record_portfolio_snapshot()` once (imported from `app.api.portfolio`). Do not call it per-trade in the chat flow — one snapshot at the end is sufficient.
- **D-06:** For watchlist changes: `action="add"` → call the same logic as `POST /api/watchlist`; `action="remove"` → same as `DELETE /api/watchlist/{ticker}`. Reuse the DB mutations directly (not via HTTP — internal calls only). Errors (e.g., duplicate add) are collected and reported in the message, not raised as HTTPExceptions.

### Module Structure
- **D-07:** Single file: `backend/app/api/chat.py`. Route handler + prompt building + LLM call + execution all inline. Consistent with `portfolio.py` (13 KB, one file). No service layer abstraction. Import `record_portfolio_snapshot` from `app.api.portfolio` to avoid duplicating snapshot logic.
- **D-08:** Register chat router in `main.py` with `prefix="/api"`: `app.include_router(chat_router, prefix="/api")`.

### Mock Mode
- **D-09:** `LLM_MOCK=true` env var → skip the LiteLLM call and return a fixed structured response. The mock should include a message, at least one trade, and at least one watchlist change so all code paths are exercised in E2E tests. Example: `{"message": "Mock: I'll buy 1 AAPL for you and add PYPL to your watchlist.", "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 1}], "watchlist_changes": [{"ticker": "PYPL", "action": "add"}]}`.
- **D-10:** Mock detection: `os.getenv("LLM_MOCK", "").lower() == "true"` at the top of the route handler. No global import-time check — keeps the route testable in isolation.

### System Prompt Structure
- **D-11:** Build the system prompt with live portfolio context injected at call time (not cached): current cash balance, all positions with current price / unrealized P&L / pnl_percent, full watchlist with live prices, total portfolio value. Use `state.price_cache.get_price(ticker)` for live prices. Format as readable text (not JSON) — LLMs respond better to natural-language context.
- **D-12:** System message persona: "You are FinAlly, an AI trading assistant. You analyze portfolios, suggest trades, and execute them when asked. Always respond with valid JSON matching the schema. Be concise and data-driven."

### Chat Message Persistence
- **D-13:** Persist both the user message and assistant response in `chat_messages`. Store the user message first (before calling LLM), then store the assistant response with `actions` JSON containing the executed trades and watchlist changes. If the LLM fails (fallback path), still persist the user message and the fallback assistant message.

### Claude's Discretion
- Exact Pydantic model names, SQL query style, error string formats, function names — all up to the planning and execution agents.
- `reasoning_effort="low"` per cerebras skill (fast inference).
- LiteLLM `completion()` call is synchronous — wrap with `asyncio.to_thread()` or call it directly from a sync route handler. Since FastAPI runs sync routes in thread pool, calling `completion()` directly from a sync `def` route is acceptable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary Spec
- `planning/PLAN.md` §9 (LLM Integration) — full pipeline description, structured output schema, system prompt guidance, auto-execution behavior, mock mode, LLM provider choice
- `planning/PLAN.md` §7 (Database) — `chat_messages` table schema: `id`, `user_id`, `role`, `content`, `actions` (JSON), `created_at`
- `planning/PLAN.md` §8 (API Endpoints) — `POST /api/chat` contract

### Requirements
- `.planning/REQUIREMENTS.md` §LLM (LLM-01 through LLM-06) — 6 requirements this phase must satisfy
- `.planning/REQUIREMENTS.md` §API (API-07) — chat endpoint requirement

### LLM Integration Pattern
- `.claude/skills/cerebras/SKILL.md` — exact LiteLLM call pattern: `MODEL = "openrouter/openai/gpt-oss-120b"`, `EXTRA_BODY = {"provider": {"order": ["cerebras"]}}`, structured output via `response_format=MyBaseModelSubclass`, `reasoning_effort="low"`

### Existing Backend Code
- `backend/app/api/portfolio.py` — `record_portfolio_snapshot()` (import and reuse); trade execution DB logic (replicate for LLM-triggered trades)
- `backend/app/api/watchlist.py` — watchlist DB mutations to replicate for LLM-triggered changes
- `backend/app/state.py` — `price_cache` and `market_source` singletons
- `backend/app/db/init_db.py` — `get_db_path()` for `chat_messages` table access
- `backend/app/main.py` — router registration pattern
- `backend/CLAUDE.md` — coding conventions, `uv run` requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app.api.portfolio.record_portfolio_snapshot(db_path, cache)` — import directly; call once after all LLM trades execute
- `app.db.get_db_path()` — use everywhere a DB path is needed
- `app.state.price_cache.get_price(ticker)` — live price lookup for system prompt and trade validation
- `app.state.price_cache.get_all()` — all prices for system prompt (portfolio context building mirrors `GET /api/portfolio`)
- `app.state.market_source.add_ticker()` / `remove_ticker()` — for LLM-triggered watchlist changes

### Established Patterns
- **sqlite3 only** — raw queries with context manager (`with sqlite3.connect(get_db_path()) as conn:`), no ORM
- **Module-level singletons via `import app.state as state`** — attribute access for mock.patch compatibility
- **One router file per domain** — `chat.py` follows `portfolio.py` and `watchlist.py` structure
- **`uv run`** — all Python commands use `uv run`; tests run with `uv run --extra dev pytest`
- **litellm already available** — add it via `uv add litellm` if not already in pyproject.toml

### Integration Points
- `main.py`: import `chat_router` from `app.api.chat`, register with `app.include_router(chat_router, prefix="/api")`
- `chat.py` imports `record_portfolio_snapshot` from `app.api.portfolio` (avoids duplicating snapshot logic)
- `chat_messages` table is already created by Phase 1's `init_db()` — no schema changes needed
- Chat trade execution replicates portfolio.py's DB mutations inline (not calling the HTTP endpoint)

</code_context>

<specifics>
## Specific Ideas

- User preference: lean code, no unnecessary abstractions ("scegli tu sulla base delle best practices del settore" — defer to industry norms, not custom layers)
- Single `chat.py` file — all logic inline, consistent with existing API modules
- All 4 implementation choices were delegated to best-practice defaults — no overrides from user

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-LLM Chat Integration*
*Context gathered: 2026-05-15*
