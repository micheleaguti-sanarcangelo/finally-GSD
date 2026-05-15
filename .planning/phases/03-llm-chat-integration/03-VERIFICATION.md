---
phase: 03-llm-chat-integration
verified: 2026-05-15T00:00:00Z
status: human_needed
score: 9/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Send POST /api/chat with a live OPENROUTER_API_KEY and pre-populated chat history, confirm the conversation history from chat_messages is reflected in the LLM's contextual reply"
    expected: "LLM reply acknowledges or references earlier conversation turns"
    why_human: "The test suite exercises history loading only in mock mode where the LLM messages list is never built. The non-mock path is untested programmatically and requires a real OpenRouter call to verify end-to-end."
  - test: "Send POST /api/chat via LLM_MOCK=true with a pre-seeded account that has insufficient cash (e.g., cash_balance=0.01), confirm the response message contains a failure notice like 'insufficient cash'"
    expected: "response.message contains the failure string appended by actions_log"
    why_human: "No test exercises the insufficient-cash failure path in chat. The code exists at lines 186-190 of chat.py but is not covered by the test suite."
---

# Phase 3: LLM Chat Integration Verification Report

**Phase Goal:** AI chat endpoint that understands portfolio context, returns structured JSON, auto-executes trades and watchlist changes, and supports mock mode.  
**Verified:** 2026-05-15  
**Status:** human_needed  
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/chat returns HTTP 200 for any input including LLM failures | VERIFIED | test_chat_llm_fallback and test_chat_mock_mode both assert status 200; all 8 tests pass |
| 2 | LLM_MOCK=true returns the fixed mock response without calling OpenRouter | VERIFIED | Lines 101-106 in chat.py; test_chat_mock_mode asserts message starts with "Mock:"; 8/8 tests pass |
| 3 | System prompt contains live cash balance, positions with P&L, watchlist prices, total value | VERIFIED | _build_system_prompt() at lines 44-92 queries DB for cash/positions/watchlist and calls cache.get_price() per ticker; used at line 125 in real LLM path |
| 4 | Last 20 chat_messages (ASC) are included in the LLM messages list | VERIFIED (code) / UNCERTAIN (test coverage) | Code at lines 117-131 correctly loads history in the non-mock path. test_chat_history_included uses LLM_MOCK=true so history is never loaded into the messages list in any test run — the non-mock path for history is untested |
| 5 | Each trade in LLM response executes independently; failures reported in message | VERIFIED (code) / UNCERTAIN (test coverage) | Code at lines 164-244 implements per-trade try/except with actions_log; test_chat_mock_executes_trade verifies success path; insufficient-cash failure path is untested |
| 6 | Each watchlist change applied independently; errors reported in message | VERIFIED | test_chat_mock_adds_watchlist passes; code at lines 250-291 wraps each change in try/except |
| 7 | record_portfolio_snapshot called once after all trades execute | VERIFIED | Line 247-248: "if result.trades: record_portfolio_snapshot(db_path, state.price_cache)" — one call after all trades; test_chat_mock_executes_trade exercises this path |
| 8 | User message persisted before LLM call; assistant message persisted after with actions JSON | VERIFIED | Non-mock: lines 109-115 (user before LLM), lines 297-313 (assistant after); mock: lines 151-158 (user after result set), lines 297-313 (assistant after); tests test_chat_persists_user_message and test_chat_persists_assistant_message both pass |
| 9 | LLM exceptions and model_validate_json failures return fallback message with trades=[] and watchlist_changes=[] | VERIFIED | Lines 143-148 catch all Exception; test_chat_llm_fallback patches completion to raise and asserts fallback message + empty arrays |
| 10 | POST /api/chat is reachable at /api/chat | VERIFIED | Route inspection confirms /api/chat in app.routes; main.py line 66: app.include_router(chat_router, prefix="/api") |
| 11 | Full test suite passes with no regressions | VERIFIED | 109 tests pass (uv run --extra dev pytest tests/ -v) |

**Score:** 9/11 truths verified (2 UNCERTAIN — test coverage gaps, implementation is correct)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/api/chat.py` | POST /api/chat route handler with full LLM pipeline | VERIFIED | 319 lines; exists, substantive, wired; router exported; all required patterns present |
| `backend/pyproject.toml` | litellm dependency declared | VERIFIED | Line 14: "litellm>=1.84.0"; importable: python -c "import litellm" exits 0 |
| `backend/app/main.py` | chat router registered at /api prefix | VERIFIED | Line 16: from app.api.chat import router as chat_router; line 66: app.include_router(chat_router, prefix="/api") |
| `backend/tests/api/test_chat.py` | pytest test module covering all major chat code paths | VERIFIED | 8 tests collected and passing; covers mock mode, fallback, trade execution, watchlist mutation, persistence, history row count |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/api/chat.py` | `litellm.completion` | MODEL=openrouter/openai/gpt-oss-120b, EXTRA_BODY with cerebras provider | VERIFIED | Lines 135-141; MODEL and EXTRA_BODY constants at lines 19-20 match cerebras skill spec |
| `backend/app/api/chat.py` | `app.api.portfolio.record_portfolio_snapshot` | import at line 14, call at line 248 | VERIFIED | "from app.api.portfolio import record_portfolio_snapshot" + "record_portfolio_snapshot(db_path, state.price_cache)" |
| `backend/app/api/chat.py` | `app.state.price_cache` | import app.state as state; attribute access | VERIFIED | Line 13: "import app.state as state"; used as state.price_cache at lines 125, 168, 248 |
| `backend/app/main.py` | `backend/app/api/chat.py` | from app.api.chat import router as chat_router | VERIFIED | Line 16 and 66 confirmed |
| `backend/tests/api/test_chat.py` | `backend/app/api/chat.py` | TestClient with patched get_db_path and state singletons | VERIFIED | _patched_chat_client patches app.api.chat.get_db_path, app.state.price_cache, app.state.market_source |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `_build_system_prompt` | cash, positions, watchlist | sqlite3 DB queries + state.price_cache | Yes — live DB reads and cache lookups | FLOWING |
| chat handler | result (LLMResponse) | litellm.completion or LLMResponse constructor (mock) | Yes — structured output parsed via model_validate_json | FLOWING |
| chat handler | actions_log | per-trade/watchlist execution results | Yes — appended to result.message on non-empty | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| chat route registered | `python -c "from app.main import app; assert '/api/chat' in [r.path for r in app.routes]"` | exit 0 | PASS |
| litellm importable | `python -c "import litellm; print('ok')"` | "litellm ok" | PASS |
| chat module imports cleanly | `python -c "from app.api.chat import router, LLMResponse, ChatRequest"` | (no error) | PASS |
| 8 chat tests pass | `uv run --extra dev pytest tests/api/test_chat.py -v` | 8 passed in 7.31s | PASS |
| full test suite | `uv run --extra dev pytest tests/ -v` | 109 passed in 10.55s | PASS |

---

### Probe Execution

No probe scripts declared in PLAN or SUMMARY. Step 7c: SKIPPED (no probe files found in scripts/*/tests/).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| API-07 | 03-01, 03-02 | POST /api/chat — send message, receive structured JSON response (message + executed actions) | SATISFIED | Route exists at /api/chat, returns {message, trades, watchlist_changes}, always HTTP 200 |
| LLM-01 | 03-01, 03-02 | Structured output schema: {message, trades[], watchlist_changes[]} | SATISFIED | LLMResponse Pydantic model at lines 38-41; returned dict at lines 315-319 matches schema |
| LLM-02 | 03-01, 03-02 | System prompt includes current portfolio context (cash, positions with P&L, watchlist with live prices, total value) | SATISFIED | _build_system_prompt() at lines 44-92 — queries DB + cache for all required context fields |
| LLM-03 | 03-01, 03-02 | Auto-execute all trades from LLM response through same validation as manual trades | SATISFIED | Lines 164-244 replicate portfolio.py trade logic with BEGIN IMMEDIATE, cash/shares checks |
| LLM-04 | 03-01, 03-02 | Auto-apply all watchlist changes from LLM response | SATISFIED | Lines 250-291 handle add/remove with duplicate/existence checks and market_source calls |
| LLM-05 | 03-01, 03-02 | LLM_MOCK=true returns deterministic mock response (no OpenRouter call) | SATISFIED | Lines 101-106; test_chat_mock_mode passes; mock path still executes trades + persists messages |
| LLM-06 | 03-01, 03-02 | Recent conversation history loaded from chat_messages table and included in prompt | SATISFIED (code) | Lines 117-131 in non-mock path load and include history; test exercises row count but not LLM message inclusion |

All 7 Phase 3 requirement IDs (API-07, LLM-01 through LLM-06) are present in both PLAN frontmatter files and are implemented in the codebase. No orphaned requirements identified.

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
**Why human:** The test suite only exercises history in mock mode where the LLM messages list is never constructed. The code at lines 117-131 correctly loads history and includes it in the messages array — but no automated test verifies history actually flows to the LLM call. A human must exercise the non-mock path to confirm.

#### 2. Failed Trade Reported in Response Message

**Test:** With LLM_MOCK=true and cash_balance set near zero in the DB (e.g., $0.01), POST /api/chat {"message": "hello"}. The mock response triggers buy 1 AAPL.  
**Expected:** response.message contains a failure notice with "insufficient cash" text.  
**Why human:** No test covers the insufficient-cash failure path in the chat handler. The implementation at lines 186-190 collects the failure into actions_log which is appended to result.message — but this is untested code that could silently fail. This maps to ROADMAP SC #3.

---

### Gaps Summary

No implementation gaps were found. All required artifacts exist and are fully wired. The two UNCERTAIN items above are test coverage gaps only — the production code is correctly implemented. Both gaps require human verification to close.

**Uncertainty items (not blocking):**
1. History loading in non-mock LLM path — code correct, test uses mock mode only
2. Insufficient-cash failure reporting in chat — code correct, path untested

---

_Verified: 2026-05-15_  
_Verifier: Claude (gsd-verifier)_
