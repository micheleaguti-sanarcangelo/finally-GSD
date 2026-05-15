---
plan: 02-03
phase: 02-portfolio-trading-api
status: complete
completed_at: 2026-05-15
commits:
  - "test(02-03): RED -- failing tests for watchlist routes"
  - "feat(02-03): implement watchlist routes with market_source sync"
---

# Summary: 02-03 — Watchlist API Routes

## What Was Built

- `backend/app/api/watchlist.py` — three async routes:
  - `GET /watchlist` — returns all watched tickers with current prices from state.price_cache
  - `POST /watchlist` — adds ticker (normalized uppercase), inserts DB row, calls `await state.market_source.add_ticker()`; returns 400 on duplicate
  - `DELETE /watchlist/{ticker}` — removes ticker from DB, calls `await state.market_source.remove_ticker()`; returns 404 if not found
- `backend/app/main.py` — added watchlist_router import and `app.include_router(watchlist_router, prefix="/api")`
- `backend/tests/api/test_watchlist.py` — 6 tests with AsyncMock for market_source

## Key Files

key-files:
  created:
    - backend/app/api/watchlist.py
    - backend/tests/api/test_watchlist.py
  modified:
    - backend/app/main.py

## Deviations

- Used `import app.state as state` in watchlist.py (consistent with portfolio.py) for testability.
- Test `_patched_client` patches `app.api.watchlist.get_db_path` directly and resets `state.snapshot_task` after use.

## Test Results

- 6 new watchlist tests: all pass
- Full suite: 101/101 pass (no regressions)

## Self-Check: PASSED
