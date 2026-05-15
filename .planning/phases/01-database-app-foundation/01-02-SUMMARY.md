---
phase: 01-database-app-foundation
plan: 02
subsystem: api
tags: [fastapi, python-dotenv, uvicorn, sse, lifespan]

# Dependency graph
requires:
  - phase: 01-01
    provides: init_db, get_db_path from backend/app/db/__init__.py
  - phase: market-data-complete
    provides: PriceCache, create_market_data_source, create_stream_router from backend/app/market/
provides:
  - FastAPI app entrypoint at backend/app/main.py
  - GET /api/health endpoint returning {"status": "ok"}
  - GET /api/stream/prices SSE endpoint via market stream router
  - python-dotenv dependency loading .env from project root
  - Lifespan handler wiring DB init and market data lifecycle
affects:
  - 02-portfolio-trading-api
  - 03-llm-chat
  - 04-frontend
  - 05-docker-deployment

# Tech tracking
tech-stack:
  added: [python-dotenv>=1.2.1]
  patterns:
    - Module-level singletons for PriceCache and MarketDataSource (dependency injection at import time)
    - asynccontextmanager lifespan for FastAPI startup/shutdown
    - .env loaded from project root via Path(__file__).parent.parent.parent / ".env"

key-files:
  created:
    - backend/app/main.py
  modified:
    - backend/pyproject.toml
    - backend/uv.lock

key-decisions:
  - "Module-level PriceCache/MarketDataSource singletons so create_stream_router can be called at import time (before lifespan runs)"
  - "stream router included without /api prefix because router already defines /api/stream prefix internally"
  - "Lifespan calls source.start/stop; singletons created at module level, not inside lifespan"

patterns-established:
  - "FastAPI lifespan pattern: @asynccontextmanager, startup before yield, shutdown after"
  - "Dependency injection via module-level singletons for async subsystems"
  - "Route prefix ownership: each router owns its own /api/... prefix"

requirements-completed:
  - API-08

# Metrics
duration: 15min
completed: 2026-05-15
---

# Phase 1 Plan 02: FastAPI App Entrypoint Summary

**FastAPI app with asynccontextmanager lifespan wiring SQLite init and GBM market simulator, exposing /api/health and /api/stream/prices SSE endpoint**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-15T00:00:00Z
- **Completed:** 2026-05-15T00:15:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added python-dotenv to uv project dependencies; .env loaded from project root at module import time
- Created backend/app/main.py as the FastAPI entrypoint with full lifespan wiring
- GET /api/health returns {"status": "ok"} with HTTP 200
- GET /api/stream/prices SSE endpoint registered and streaming 10 default tickers
- All 78 pre-existing tests still pass after changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add python-dotenv dependency** - `c1ec02e` (chore)
2. **Task 2: Create FastAPI app entrypoint with lifespan, health, SSE router** - `85c42a2` (feat)

**Plan metadata:** (see final docs commit)

## Files Created/Modified

- `backend/app/main.py` - FastAPI app: .env load, module-level singletons, lifespan, health + SSE routes
- `backend/pyproject.toml` - Added python-dotenv>=1.2.1 to dependencies
- `backend/uv.lock` - Updated lockfile with python-dotenv package

## Decisions Made

- Stream router included without additional `/api` prefix since `stream.py` already defines `APIRouter(prefix="/api/stream")` internally — adding `/api` prefix at include time would have caused double-prefix `/api/api/stream/prices`
- Module-level PriceCache and MarketDataSource singletons (not inside lifespan) so `create_stream_router(price_cache)` can be called at module load time before lifespan executes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed double prefix on SSE route**
- **Found during:** Task 2 (route registration verification)
- **Issue:** Plan instruction said `app.include_router(stream_router, prefix="/api")` but the stream router already defines prefix `/api/stream` — combining them produced `/api/api/stream/prices`
- **Fix:** Removed the extra `/api` prefix from `app.include_router(stream_router)` call
- **Files modified:** backend/app/main.py
- **Verification:** Route inspection confirmed `/api/stream/prices` registered correctly; health check via live server confirmed
- **Committed in:** 85c42a2

---

**Total deviations:** 1 auto-fixed (1 bug - double route prefix)
**Impact on plan:** Fix essential for correct SSE endpoint path. No scope creep.

## Issues Encountered

- Route double-prefix issue during verification; identified immediately by inspecting `app.routes` and fixed before commit.

## User Setup Required

None - no external service configuration required. MASSIVE_API_KEY optional (simulator used by default).

## Next Phase Readiness

- FastAPI app starts cleanly on port 8000/8001 with `uv run uvicorn app.main:app`
- DB initializes on first startup (db/finally.db created with 6 tables and seed data)
- SSE stream operational with 10 default tickers
- Ready for Phase 2: Portfolio & Trading API (POST /api/portfolio/trade, GET /api/portfolio, etc.)

---
*Phase: 01-database-app-foundation*
*Completed: 2026-05-15*
