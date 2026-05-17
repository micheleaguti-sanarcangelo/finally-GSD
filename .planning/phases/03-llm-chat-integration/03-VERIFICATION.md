---
phase: 03-llm-chat-integration
verified: 2026-05-15T00:00:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 9/11
  gaps_closed:
    - "CR-01: User message now persisted exactly once (single INSERT at lines 154-161)"
    - "CR-02: Watchlist add uses INSERT OR IGNORE (line 259) — TOCTOU race eliminated"
    - "CR-03: BEGIN IMMEDIATE removed; ValueError raised on cash/shares failure; except ValueError catches it (lines 188-192, 214-219, 243-244)"
    - "WR-01/IN-01: Module logger added (line 20); logger.exception() on LLM failures (line 147)"
    - "WR-02: TradeAction.side is Literal['buy','sell'] (line 32); quantity validated positive (lines 35-39)"
    - "WR-03: History query uses DESC LIMIT 20 subquery re-ordered ASC (lines 120-125)"
    - "WR-04: httpx moved to project.optional-dependencies dev section (pyproject.toml line 22)"
    - "WR-05: Startup baseline snapshot recorded in lifespan (main.py lines 47-50)"
    - "IN-02: System prompt remove example includes ticker field (chat.py line 101)"
  gaps_remaining:
    - "Conversation history passing to LLM in non-mock path is still untested programmatically"
    - "Insufficient-cash failure reported in response.message still has no automated test"
  regressions: []
human_verification:
  - test: "Start the backend with a real OPENROUTER_API_KEY, send two chat messages, verify the third response acknowledges the prior conversation"
    expected: "LLM reply incorporates context from earlier turns stored in chat_messages"
    why_human: "The WR-03 fix corrects the history query (DESC LIMIT 20 subquery re-ordered ASC) at the code level, but every test that exercises history (test_chat_history_included) uses LLM_MOCK=true. In mock mode the code never enters the non-mock branch where the history SELECT runs (line 119-125), so no automated test verifies that the corrected query actually flows to the LLM call. A human must exercise the non-mock path with a real OpenRouter key to confirm end-to-end."
  - test: "With LLM_MOCK=true and cash_balance set near zero in the DB (e.g., $0.01), POST /api/chat {\"message\": \"hello\"}. The mock response triggers buy 1 AAPL at $150."
    expected: "response.message contains the failure notice appended by actions_log, e.g., 'Trade failed buy 1.0 AAPL: insufficient cash (need $150.00, have $0.01)'"
    why_human: "The CR-03 fix correctly raises ValueError and catches it into actions_log (lines 188-192, 243-244), and actions_log is appended to result.message (lines 291-292). However, no test in test_chat.py seeds the DB with near-zero cash before calling the endpoint — the insufficient-cash failure path in the chat handler is still untested code. The fix is structurally correct but unproven by the test suite."
---

# Phase 3: LLM Chat Integration Verification Report

**Phase Goal:** AI chat endpoint that understands portfolio context, returns structured JSON, auto-executes trades and watchlist changes, and supports mock mode.
**Verified:** 2026-05-15
**Status:** human_needed
**Re-verification:** Yes — after CR-01, CR-02, CR-03, WR-01 through WR-05, IN-01, IN-02 fixes applied

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/chat returns HTTP 200 for any input including LLM failures | VERIFIED | test_chat_llm_fallback and test_chat_mock_mode both assert status 200; all 8 tests pass |
| 2 | LLM_MOCK=true returns the fixed mock response without calling OpenRouter | VERIFIED | Lines 111-116 in chat.py; test_chat_mock_mode asserts message starts with "Mock:"; 8/8 tests pass |
| 3 | System prompt contains live cash balance, positions with P&L, watchlist prices, total value | VERIFIED | _build_system_prompt() at lines 54-102 queries DB for cash/positions/watchlist and calls cache.get_price() per ticker; used at line 128 in real LLM path |
| 4 | Last 20 chat_messages (ASC) are included in the LLM messages list | VERIFIED (code) / UNCERTAIN (test coverage) | WR-03 fix: lines 120-125 use DESC LIMIT 20 subquery re-ordered ASC — correct query. test_chat_history_included uses LLM_MOCK=true so the SELECT at lines 119-125 never executes in any test; non-mock path for history loading is untested |
| 5 | Each trade in LLM response executes independently; failures reported in message | VERIFIED (code) / UNCERTAIN (test coverage) | CR-03 fix: ValueError raised (lines 188-192, 214-219), caught at line 243, appended to actions_log; appended to result.message (lines 291-292). No test seeds near-zero cash to exercise the failure path |
| 6 | Each watchlist change applied independently; errors reported in message | VERIFIED | test_chat_mock_adds_watchlist passes; lines 253-288 wrap each change in try/except; CR-02: INSERT OR IGNORE at line 259 |
| 7 | record_portfolio_snapshot called once after all trades execute | VERIFIED | Lines 248-250: "if result.trades: record_portfolio_snapshot(db_path, state.price_cache)" — one call after all trades; test_chat_mock_executes_trade exercises this path |
| 8 | User message persisted exactly once before execution; assistant message persisted after with actions JSON | VERIFIED | CR-01 fix: single INSERT at lines 154-161 (after mock/LLM branch, before trade loop). Assistant INSERT at lines 295-310. tests test_chat_persists_user_message and test_chat_persists_assistant_message both pass |
| 9 | LLM exceptions and model_validate_json failures return fallback message with trades=[] and watchlist_changes=[] | VERIFIED | Lines 146-152 catch all Exception; WR-01: logger.exception() at line 147; test_chat_llm_fallback patches completion to raise and asserts fallback message + empty arrays |
| 10 | POST /api/chat is reachable at /api/chat | VERIFIED | main.py line 69: app.include_router(chat_router, prefix="/api"); route confirmed at /api/chat |
| 11 | Full test suite passes with no regressions | VERIFIED | 109 tests pass (uv run --extra dev pytest tests/ -v — verified live during re-verification) |

**Score:** 11/11 truths verified at code level (2 UNCERTAIN on test coverage only — implementation is correct)

---

### Fixes Verified

All nine fix items were confirmed in the codebase:

| Fix ID | Claim | Code Evidence | Status |
|--------|-------|---------------|--------|
| CR-01 | User message persisted exactly once | Single INSERT at lines 154-161; no second INSERT in mock branch | VERIFIED |
| CR-02 | Watchlist add uses INSERT OR IGNORE | Line 259: `INSERT OR IGNORE INTO watchlist` | VERIFIED |
| CR-03 | BEGIN IMMEDIATE removed; ValueError raised and caught | No BEGIN IMMEDIATE in trade loop; ValueError at lines 188-192, 214-219; except ValueError line 243 | VERIFIED |
| WR-01/IN-01 | Module logger; logger.exception on LLM failure | Line 20: `logger = logging.getLogger(__name__)`; line 147: `logger.exception(...)` | VERIFIED |
| WR-02 | side is Literal["buy","sell"]; quantity validated positive | Line 32: `Literal["buy", "sell"]`; lines 35-39: field_validator returning ValueError | VERIFIED |
| WR-03 | History query fetches most recent 20 in chronological order | Lines 120-125: subquery DESC LIMIT 20 wrapped in outer ORDER BY ASC | VERIFIED |
| WR-04 | httpx in optional-dependencies | pyproject.toml line 22: httpx under `[project.optional-dependencies]` dev | VERIFIED |
| WR-05 | Startup baseline snapshot | main.py lines 47-50: record_portfolio_snapshot called in lifespan before yield | VERIFIED |
| IN-02 | System prompt remove example has ticker | Line 101: `"watchlist_changes items: ... or {\"ticker\": \"PYPL\", \"action\": \"remove\"}"` | VERIFIED |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/api/chat.py` | POST /api/chat route handler with full LLM pipeline | VERIFIED | 317 lines; exists, substantive, wired; all fix patterns present |
| `backend/pyproject.toml` | litellm dependency declared; httpx in optional-dependencies | VERIFIED | Line 14: `litellm>=1.84.0`; line 22: `httpx>=0.28.1` under dev extras |
| `backend/app/main.py` | chat router registered at /api prefix; startup snapshot | VERIFIED | Line 16: import; line 69: include_router; lines 47-50: startup snapshot |
| `backend/tests/api/test_chat.py` | pytest test module covering all major chat code paths | VERIFIED | 8 tests collected and passing; all CR/WR fixes structurally covered except insufficient-cash failure path |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/api/chat.py` | `litellm.completion` | MODEL=openrouter/openai/gpt-oss-120b:free, EXTRA_BODY with cerebras provider | VERIFIED | Lines 138-144; MODEL and EXTRA_BODY constants at lines 22-23 |
| `backend/app/api/chat.py` | `app.api.portfolio.record_portfolio_snapshot` | import at line 16, call at line 250 | VERIFIED | `from app.api.portfolio import record_portfolio_snapshot` + `record_portfolio_snapshot(db_path, state.price_cache)` |
| `backend/app/api/chat.py` | `app.state.price_cache` | import app.state as state; attribute access | VERIFIED | Line 15: `import app.state as state`; used as state.price_cache at lines 128, 171, 250 |
| `backend/app/main.py` | `backend/app/api/chat.py` | from app.api.chat import router as chat_router | VERIFIED | Lines 16 and 69 confirmed |
| `backend/tests/api/test_chat.py` | `backend/app/api/chat.py` | TestClient with patched get_db_path and state singletons | VERIFIED | _patched_chat_client patches app.api.chat.get_db_path, app.state.price_cache, app.state.market_source |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `_build_system_prompt` | cash, positions, watchlist | sqlite3 DB queries + state.price_cache | Yes — live DB reads and cache lookups | FLOWING |
| chat handler | result (LLMResponse) | litellm.completion or LLMResponse constructor (mock) | Yes — structured output parsed via model_validate_json | FLOWING |
| chat handler | actions_log | per-trade/watchlist execution results including ValueError messages | Yes — appended to result.message on non-empty | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| chat route registered | confirmed via main.py line 69 | `app.include_router(chat_router, prefix="/api")` | PASS |
| litellm importable | pyproject.toml line 14 | `litellm>=1.84.0` present | PASS |
| Literal["buy","sell"] present | chat.py line 32 | `side: Literal["buy", "sell"]` | PASS |
| logger.exception on LLM failure | chat.py line 147 | `logger.exception("LLM call or parse failed")` | PASS |
| 8 chat tests pass | `uv run --extra dev pytest tests/api/test_chat.py -v` | 8 passed in 5.13s | PASS |
| full test suite | `uv run --extra dev pytest tests/ -v` | 109 passed in 8.39s | PASS |

---

### Probe Execution

No probe scripts declared in PLAN or SUMMARY. Step 7c: SKIPPED (no probe files found in scripts/*/tests/).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| API-07 | 03-01, 03-02 | POST /api/chat — send message, receive structured JSON response (message + executed actions) | SATISFIED | Route at /api/chat returns {message, trades, watchlist_changes}, always HTTP 200 |
| LLM-01 | 03-01, 03-02 | Structured output schema: {message, trades[], watchlist_changes[]} | SATISFIED | LLMResponse at lines 48-51; returned dict at lines 312-316 matches schema; WR-02 adds Literal type and quantity validation |
| LLM-02 | 03-01, 03-02 | System prompt includes current portfolio context (cash, positions with P&L, watchlist with live prices, total value) | SATISFIED | _build_system_prompt() at lines 54-102 — queries DB + cache for all required context fields |
| LLM-03 | 03-01, 03-02 | Auto-execute all trades from LLM response through same validation as manual trades | SATISFIED | Lines 166-246 implement per-trade validation with ValueError for cash/shares failures; CR-03 removes transaction isolation mismatch |
| LLM-04 | 03-01, 03-02 | Auto-apply all watchlist changes from LLM response | SATISFIED | Lines 253-288 handle add/remove; CR-02: INSERT OR IGNORE eliminates duplicate race |
| LLM-05 | 03-01, 03-02 | LLM_MOCK=true returns deterministic mock response (no OpenRouter call) | SATISFIED | Lines 111-116; test_chat_mock_mode passes; mock path executes trades + persists messages |
| LLM-06 | 03-01, 03-02 | Recent conversation history loaded from chat_messages table and included in prompt | SATISFIED (code) | WR-03: lines 120-125 now correctly load last 20 in chronological order; test exercises row count but not LLM message inclusion in non-mock path |

All 7 Phase 3 requirement IDs satisfied at code level. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| No debt markers, stubs, or placeholder patterns found in chat.py, main.py, or test_chat.py | — | — | — | — |

Checked for: TBD, FIXME, XXX, TODO, HACK, PLACEHOLDER, return null, return {}, return [], empty handlers. None found.

---

### Human Verification Required

#### 1. Conversation History Passed to LLM (Non-Mock Path)

**Test:** Start the backend with a real OPENROUTER_API_KEY, send two chat messages, verify the third response acknowledges the prior conversation.
**Expected:** LLM reply incorporates context from earlier turns stored in chat_messages.
**Why human:** The WR-03 fix corrects the query at lines 120-125 (DESC LIMIT 20 subquery re-ordered ASC). However, `test_chat_history_included` uses `LLM_MOCK=true`, which means the code enters the `if os.getenv("LLM_MOCK"...)` branch at line 111 and never reaches the history SELECT at line 119. No automated test verifies that the corrected query runs and its results flow into the `messages` list sent to the LLM. A human must exercise the non-mock path with a real OpenRouter key to confirm.

#### 2. Insufficient-Cash Failure Reported in Response Message

**Test:** With LLM_MOCK=true and cash_balance set to $0.01 in the test DB (UPDATE users_profile SET cash_balance=0.01 WHERE id='default'), POST /api/chat {"message": "hello"}. The fixed mock response triggers buy 1 AAPL at $150.00.
**Expected:** response.message contains the failure notice, e.g., "Trade failed buy 1.0 AAPL: insufficient cash (need $150.00, have $0.01)".
**Why human:** The CR-03 fix raises ValueError at lines 188-192 and catches it at line 243, appending to actions_log. actions_log is appended to result.message at lines 291-292. The implementation is structurally correct. However, no test in test_chat.py seeds near-zero cash before calling the endpoint — the code path exists but is unexercised by the automated suite. This maps to ROADMAP SC "each trade executes independently; failures are reported in the message".

---

### Gaps Summary

No implementation gaps remain. All CR and WR fix items are confirmed in the codebase. The two UNCERTAIN items are test coverage gaps only — the production code correctly implements both behaviors. The phase goal is achieved at the implementation level.

**Open human verification items (not blocking implementation):**
1. History loading in non-mock LLM path — code correct after WR-03, test uses mock mode only
2. Insufficient-cash failure reporting in chat — code correct after CR-03, path untested in automated suite

---

_Verified: 2026-05-15_
_Verifier: Claude (gsd-verifier)_
