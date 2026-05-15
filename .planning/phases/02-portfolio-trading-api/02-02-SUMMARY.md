---
plan: 02-02
phase: 02-portfolio-trading-api
status: complete
completed_at: 2026-05-15
commits:
  - "test(02-02): RED -- failing tests for portfolio routes"
  - "feat(02-02): implement portfolio routes and snapshot task"
---

# Summary: 02-02 — Portfolio API Routes + Snapshot Task

## What Was Built

- `backend/app/api/portfolio.py` — three routes and snapshot function:
  - `GET /portfolio` — positions with live P&L (current_price, unrealized_pnl, pnl_percent), cash_balance, total_value
  - `POST /portfolio/trade` — buy/sell market orders with validation: cash check, shares check, weighted avg_cost, zero-qty delete, 503 on missing price, snapshot after each trade
  - `GET /portfolio/history` — portfolio_snapshots ordered by recorded_at
  - `record_portfolio_snapshot(db_path, cache)` — standalone function for direct call + snapshot_loop use
- `backend/app/main.py` — extended with snapshot_loop (asyncio task, 30s interval), task lifecycle in lifespan (create_task on startup, cancel on shutdown), portfolio_router registered with prefix="/api"
- `backend/tests/api/test_portfolio.py` — 13 tests covering all trade scenarios and edge cases

## Key Files

key-files:
  created:
    - backend/app/api/portfolio.py
    - backend/tests/api/test_portfolio.py
  modified:
    - backend/app/main.py

## Deviations

- Used `import app.state as state` (attribute access) instead of `from app.state import price_cache` (direct import) to ensure mock.patch works correctly in tests.
- Added `httpx` as dev dependency (required by FastAPI TestClient / starlette).
- Test `_patched_client` resets `state.snapshot_task = None` after use to prevent cross-test state pollution.

## Test Results

- 13 new portfolio tests: all pass
- Full suite: 95/95 pass (no regressions)

## Self-Check: PASSED
