# Phase 2: Portfolio & Trading API - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete portfolio and trading REST API: positions with live P&L, trade execution with validation, watchlist CRUD with market-source sync, and a background portfolio snapshot task. This is all backend — no frontend. The result is a fully functional API that the frontend (Phase 4) can drive.

The scope is exactly the 11 requirements: API-01 through API-06 and TRADE-01 through TRADE-05.

</domain>

<decisions>
## Implementation Decisions

### Router & File Structure
- **D-01:** Create `backend/app/api/` package with two router files: `portfolio.py` (portfolio + trading routes) and `watchlist.py` (watchlist routes). Add `backend/app/api/__init__.py` as empty package marker.
- **D-02:** Register both routers in `main.py` with `prefix="/api"`: `app.include_router(portfolio_router, prefix="/api")` and `app.include_router(watchlist_router, prefix="/api")`. Keep `main.py` thin — it only wires things together.

### Shared State (PriceCache + MarketDataSource)
- **D-03:** Move `price_cache` and `market_source` out of `main.py` into a new `backend/app/state.py` module as module-level singletons. Both `main.py` (lifespan) and API routes import from `app.state`. This eliminates circular import risk cleanly — no DI boilerplate needed for a single-user app this size.
- **D-04:** `main.py` lifespan calls `state.market_source.start(...)` / `state.market_source.stop()` and `state.price_cache` remains the shared cache. Routes import `from app.state import price_cache, market_source` directly.

### Error Response Format
- **D-05:** Use `HTTPException(status_code=400, detail="<clear message>")` for all business logic validation failures. FastAPI serializes this as `{"detail": "message"}`. No custom error wrapper needed.
- **D-06:** Status codes: 400 for validation failures (insufficient cash, not enough shares, ticker already in watchlist), 404 for resource-not-found (ticker not in watchlist for DELETE), 503 if a required price is not in cache (price unavailable). Never use 422 for business logic — reserve 422 for request schema validation only.
- **D-07:** Error messages should be human-readable and specific: `"Insufficient cash: need $X, have $Y"`, `"Insufficient shares: have N, selling M"`, `"Ticker AAPL already in watchlist"`.

### Portfolio Snapshot Background Task
- **D-08:** Define a `record_portfolio_snapshot(db_path, price_cache)` function in `backend/app/api/portfolio.py`. It reads current positions from DB, looks up each position's current price from `price_cache`, computes total_value = cash + sum(qty × price), and inserts a row into `portfolio_snapshots`.
- **D-09:** In `main.py` lifespan, start an asyncio background task: `asyncio.create_task(snapshot_loop())` where `snapshot_loop()` calls `record_portfolio_snapshot()` then `await asyncio.sleep(30)` in a loop. Store the task in `app.state.snapshot_task` and cancel it in the shutdown branch of the lifespan.
- **D-10:** Trade handlers call `record_portfolio_snapshot()` directly (synchronously within the async route) immediately after completing a trade. No queue, no background scheduling for the post-trade snapshot.

### Trade Execution Logic
- **D-11:** `avg_cost` on buy: `new_avg = (existing_qty × existing_avg_cost + trade_qty × trade_price) / (existing_qty + trade_qty)`. Use UPSERT (`INSERT OR REPLACE` or `UPDATE/INSERT` pattern) on the `positions` table.
- **D-12:** Position removal: when a sell brings quantity to 0, delete the row from `positions`. Do not keep zero-quantity rows.
- **D-13:** Trade price is always `price_cache.get_price(ticker)`. If the ticker is not in the cache, raise `HTTPException(503, detail="Price unavailable for {ticker}")`.
- **D-14:** Append a row to `trades` table for every executed trade (buys and sells). This is an audit log — never update or delete.

### Watchlist-to-Market-Source Sync
- **D-15:** `POST /api/watchlist` (add ticker): insert into DB `watchlist` table, then call `await market_source.add_ticker(ticker)`. Return immediately after both — the price will appear in the SSE stream within the next poll interval.
- **D-16:** `DELETE /api/watchlist/{ticker}`: delete from DB `watchlist` table, then call `await market_source.remove_ticker(ticker)`. If the ticker is not in the DB watchlist, return 404.

### Claude's Discretion
- Full implementation details (SQL queries, exact Pydantic response models, async/sync choices within FastAPI, test structure) are left to the planning and execution agents. User preference: lean code, no unnecessary abstractions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Spec (primary source of truth)
- `planning/PLAN.md` §7 (Database schema), §8 (API Endpoints), §6 (Market Data / PriceCache interface) — defines all table schemas, endpoint contracts, and the MarketDataSource lifecycle

### Requirements
- `.planning/REQUIREMENTS.md` §API (API-01–06), §TRADE (TRADE-01–05) — the 11 requirements this phase must satisfy

### Existing Backend Code
- `backend/app/main.py` — current app entrypoint; Phase 2 will refactor to import from `app.state` and register new routers
- `backend/app/db/init_db.py` — `get_db_path()` used by all DB-accessing routes
- `backend/app/market/__init__.py` — exports `PriceCache`, `MarketDataSource`, `create_market_data_source`; `PriceCache.get_price(ticker)` is the price lookup method
- `backend/app/market/interface.py` — `MarketDataSource` abstract class; check `add_ticker` and `remove_ticker` method signatures
- `backend/CLAUDE.md` — coding conventions and `uv run` requirements for this project

### Phase 1 Artifacts
- `.planning/phases/01-database-app-foundation/01-01-SUMMARY.md` — DB module summary (schema, seeding patterns)
- `.planning/phases/01-database-app-foundation/01-02-SUMMARY.md` — FastAPI wiring summary (lifespan pattern, module-level singletons)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app.db.get_db_path()` — use this everywhere a DB path is needed; do not hardcode paths
- `app.state.price_cache` (after refactor) — `price_cache.get_price(ticker) -> float | None` for trade execution; `price_cache.get_all() -> dict[str, PriceUpdate]` for portfolio response
- `app.state.market_source` (after refactor) — `await market_source.add_ticker(ticker)` / `await market_source.remove_ticker(ticker)` for watchlist sync
- `app.market.seed_prices.SEED_PRICES` — default tickers, used to seed watchlist (already done in Phase 1)

### Established Patterns
- **sqlite3 only** — no ORM. All DB access uses `sqlite3.connect(get_db_path())` with context manager (`with conn:`). No SQLAlchemy, no Tortoise, no databases lib.
- **uv project** — all Python commands use `uv run`. Tests run with `uv run --extra dev pytest`.
- **Module-level singletons** — Phase 1 established this pattern for `price_cache` and `market_source`; Phase 2 extracts them to `app/state.py`.
- **INSERT OR IGNORE for idempotency** — established in Phase 1 for seed data; apply the same to watchlist adds.
- **asynccontextmanager lifespan** — already wired in `main.py`; Phase 2 extends it to cancel the snapshot task.

### Integration Points
- `main.py` lifespan: extend startup to `asyncio.create_task(snapshot_loop())` and store in `app.state.snapshot_task`; extend shutdown to cancel it
- `main.py` refactor: import `price_cache, market_source` from `app.state` instead of creating them inline
- New routers registered via `app.include_router(...)` in `main.py` — same pattern as the stream router in Phase 1

</code_context>

<specifics>
## Specific Ideas

- User preference: lean code, no unnecessary code, no premature abstractions. Three similar lines is better than a helper function.
- "La piattaforma veloce" (fast platform) — favor direct DB calls over any caching layer for portfolio data. SQLite is fast enough for single-user.
- No `BaseModel` inheritance pyramid — keep Pydantic models flat and minimal. One model per endpoint response shape is fine.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Portfolio & Trading API*
*Context gathered: 2026-05-15*
