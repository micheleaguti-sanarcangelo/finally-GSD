---
phase: 03-llm-chat-integration
fixed_at: 2026-05-15T21:30:00Z
review_path: .planning/phases/03-llm-chat-integration/03-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-15T21:30:00Z
**Source review:** .planning/phases/03-llm-chat-integration/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04, WR-05, IN-01, IN-02)
- Fixed: 10
- Skipped: 0

## Fixed Issues

### WR-04: httpx moved to project.optional-dependencies

**Files modified:** `backend/pyproject.toml`, `backend/uv.lock`
**Commit:** 40aad7b (pyproject.toml), fd8fe6e (uv.lock)
**Applied fix:** Moved `httpx>=0.28.1` from the PEP 735 `[dependency-groups]` section into `[project.optional-dependencies]` dev list. Removed `[dependency-groups]` section entirely. Updated uv.lock to reflect the change.

---

### WR-05: Record baseline portfolio snapshot at startup

**Files modified:** `backend/app/main.py`, `backend/tests/api/test_portfolio.py`
**Commit:** 7d3b247 (main.py), 07ba161 (test fix)
**Applied fix:** Added an initial `record_portfolio_snapshot()` call in the `lifespan` startup block, after `await state.market_source.start(tickers_to_track)`. The `snapshot_loop` was also restructured to put the `asyncio.sleep(30)` at the top of the `while True` loop (periodic only), so the loop no longer sleeps before its first run. The startup snapshot captures the baseline before any trades. Updated `test_snapshot_after_trade` to assert `count >= 2` (startup + trade snapshots).

---

### CR-01: User message inserted twice / duplicate LLM context

**Files modified:** `backend/app/api/chat.py`
**Commit:** 26a5243
**Applied fix:** Removed the early user-message INSERT that ran before history was loaded (in the non-mock path). Removed the duplicate mock-mode persist block that ran at line 151-158. Now the user message is persisted exactly once, after the LLM result is determined (mock or live), before trade execution. The history query no longer includes the just-inserted user message since the INSERT now happens after history is loaded.

---

### CR-02: Watchlist add TOCTOU race and partial state

**Files modified:** `backend/app/api/chat.py`
**Commit:** 26a5243
**Applied fix:** Replaced the SELECT-check + separate INSERT pattern with a single `INSERT OR IGNORE`. After the insert, checks `cursor.rowcount == 0` to detect if the ticker was already present. Only calls `await state.market_source.add_ticker(ticker)` after confirming a new row was actually inserted (rowcount > 0). This eliminates the TOCTOU window and ensures DB and market source stay in sync.

---

### CR-03: BEGIN IMMEDIATE inside context manager + continue leaks

**Files modified:** `backend/app/api/chat.py`
**Commit:** 26a5243
**Applied fix:** Removed the `conn.execute("BEGIN IMMEDIATE")` call. The `sqlite3.connect` context manager handles transactions automatically. Replaced the `continue` statements for insufficient cash and insufficient shares with `raise ValueError(...)`. Added `except ValueError as exc: actions_log.append(str(exc))` before the generic `except Exception` catch so validation failures are logged cleanly without touching the generic error path.

---

### WR-01 / IN-01: Silent exception swallow, no module logger

**Files modified:** `backend/app/api/chat.py`
**Commit:** 26a5243
**Applied fix:** Added `import logging` and `logger = logging.getLogger(__name__)` at module level. In the LLM call except block, added `logger.exception("LLM call or parse failed")` before constructing the fallback response. LLM failures (rate limits, auth errors, schema mismatches) now appear in server logs.

---

### WR-02: No validation on TradeAction.side or quantity

**Files modified:** `backend/app/api/chat.py`
**Commit:** 26a5243
**Applied fix:** Changed `TradeAction.side` from `str` to `Literal["buy", "sell"]` (added `from typing import Literal`). Added `@field_validator("quantity")` to reject non-positive values (added `field_validator` to pydantic import). Pydantic now rejects invalid LLM responses at parse time, before any trade logic runs. Also added `except ValueError as exc` in trade loop to catch validation failures cleanly.

---

### WR-03: History window takes oldest 20 messages instead of newest 20

**Files modified:** `backend/app/api/chat.py`
**Commit:** 26a5243
**Applied fix:** Replaced `ORDER BY created_at ASC LIMIT 20` with a subquery that takes `ORDER BY created_at DESC LIMIT 20` then re-orders the result `ASC`. The LLM now always sees the 20 most recent messages in chronological order.

---

### IN-02: Watchlist remove example missing ticker in system prompt

**Files modified:** `backend/app/api/chat.py`
**Commit:** 26a5243
**Applied fix:** Fixed the system prompt string so the "remove" example includes the `ticker` field: changed `{"action": "remove"}` to `{"ticker": "PYPL", "action": "remove"}`. Prevents the LLM from generating ticker-less remove actions that would fail validation.

---

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-05-15T21:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
