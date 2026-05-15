# Phase 2: Portfolio & Trading API - Research

**Researched:** 2026-05-15
**Domain:** FastAPI routers, SQLite trade logic, asyncio background tasks, P&L calculations
**Confidence:** HIGH — all findings verified from codebase and official FastAPI/Python docs

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Create `backend/app/api/` package with two router files: `portfolio.py` and `watchlist.py`. Add empty `__init__.py`.
- **D-02:** Register both routers in `main.py` with `prefix="/api"`.
- **D-03:** Move `price_cache` and `market_source` out of `main.py` into `backend/app/state.py` as module-level singletons.
- **D-04:** `main.py` lifespan calls `state.market_source.start/stop`. Routes import `from app.state import price_cache, market_source`.
- **D-05:** Use `HTTPException(status_code=400/404/503, detail="message")` for all business logic failures.
- **D-06:** Status codes: 400 (validation), 404 (not found), 503 (price unavailable). Never 422 for business logic.
- **D-07:** Error messages: human-readable and specific, e.g. `"Insufficient cash: need $X, have $Y"`.
- **D-08:** `record_portfolio_snapshot(db_path, price_cache)` function in `backend/app/api/portfolio.py`.
- **D-09:** asyncio background task `snapshot_loop()` started in lifespan; stored in `app.state.snapshot_task`; cancelled in shutdown.
- **D-10:** Trade handlers call `record_portfolio_snapshot()` directly after completing a trade.
- **D-11:** avg_cost formula: `new_avg = (existing_qty × existing_avg + trade_qty × trade_price) / (existing_qty + trade_qty)`. UPSERT on `positions`.
- **D-12:** Delete `positions` row when quantity reaches 0.
- **D-13:** Trade price from `price_cache.get_price(ticker)`; raise 503 if None.
- **D-14:** Append to `trades` table for every trade — audit log, never update/delete.
- **D-15:** `POST /api/watchlist`: insert into DB then `await market_source.add_ticker(ticker)`.
- **D-16:** `DELETE /api/watchlist/{ticker}`: delete from DB then `await market_source.remove_ticker(ticker)`; 404 if not found.

### Claude's Discretion
- Full implementation details: SQL queries, exact Pydantic response models, async/sync choices within FastAPI, test structure.
- User preference: lean code, no unnecessary abstractions. Three similar lines > a helper function.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | `GET /api/portfolio` — positions, cash balance, total value, unrealized P&L per position | PriceCache.get_all() + SQLite positions join; P&L = (price - avg_cost) × qty |
| API-02 | `POST /api/portfolio/trade` — market order `{ticker, quantity, side}`, instant fill | SQLite UPSERT on positions; trade validation patterns documented below |
| API-03 | `GET /api/portfolio/history` — portfolio_snapshots ordered by recorded_at | Simple SELECT, no join needed |
| API-04 | `GET /api/watchlist` — current watchlist tickers with latest prices | JOIN watchlist with price_cache in Python (not SQL) |
| API-05 | `POST /api/watchlist` — add ticker + sync market_source | INSERT OR IGNORE + await market_source.add_ticker() |
| API-06 | `DELETE /api/watchlist/{ticker}` — remove ticker + sync market_source | DELETE + await market_source.remove_ticker() |
| TRADE-01 | Market order fills at current PriceCache price | price_cache.get_price(ticker) — confirmed method exists |
| TRADE-02 | Buy validation: cash_balance >= quantity × price | Read users_profile, compare |
| TRADE-03 | Sell validation: position quantity >= sell quantity | Read positions row, compare |
| TRADE-04 | avg_cost recalculated on buy; row deleted at quantity=0 | Weighted-average formula + DELETE confirmed |
| TRADE-05 | Portfolio snapshot recorded immediately after each trade | record_portfolio_snapshot() called directly in handler |
</phase_requirements>

---

## Summary

Phase 2 builds on a complete Phase 1 foundation: all 6 SQLite tables exist, the FastAPI app runs, and the PriceCache/MarketDataSource singletons are live. The phase adds two router files, extracts shared state to `app/state.py`, implements trade execution with SQLite UPSERT patterns, and starts a background snapshot task.

The existing codebase establishes every pattern needed: `asynccontextmanager` lifespan, `asyncio.create_task` + graceful cancellation, `sqlite3` context managers with `INSERT OR IGNORE`, and module-level singletons. Phase 2 extends these patterns — no new patterns introduced.

The only non-trivial logic is the buy-side avg_cost UPSERT (weighted average formula) and the sell-side position cleanup (delete row at quantity=0). Both are straightforward SQL + Python math.

**Primary recommendation:** Follow the existing patterns exactly. Use `sqlite3` with `with conn:` blocks, keep Pydantic response models flat, use `asyncio.create_task` for the snapshot loop, and import `price_cache` / `market_source` from the new `app.state` module.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Portfolio valuation (P&L) | API / Backend | — | Reads DB positions + price cache; pure server-side computation |
| Trade execution | API / Backend | Database | Validates, writes positions/trades/cash atomically |
| Watchlist CRUD | API / Backend | Database | DB write + market_source sync both server-side |
| Portfolio snapshots | API / Backend | Database | Background task writes to DB; no client involvement |
| Price lookup for trades | API / Backend | In-memory cache | PriceCache is process-local; no DB needed |

---

## Standard Stack

### Core (already in pyproject.toml) [VERIFIED: codebase read]

| Library | Version | Purpose |
|---------|---------|---------|
| fastapi | >=0.115.0 | Router, HTTPException, path/body params |
| pydantic | bundled with fastapi | Request/response models |
| sqlite3 | stdlib | All DB access — no ORM |
| asyncio | stdlib | Background task, cancellation |
| uuid | stdlib | Primary keys for new rows |
| datetime | stdlib | Timestamps (ISO format, UTC) |

No new dependencies required for Phase 2.

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request
     |
     v
FastAPI app (main.py)
     |
     +-- app.include_router(portfolio_router, prefix="/api")
     |        |
     |        +-- GET  /api/portfolio          --> reads positions + price_cache
     |        +-- POST /api/portfolio/trade    --> validates, writes positions/trades/cash
     |        +-- GET  /api/portfolio/history  --> reads portfolio_snapshots
     |
     +-- app.include_router(watchlist_router, prefix="/api")
              |
              +-- GET    /api/watchlist        --> reads watchlist + price_cache
              +-- POST   /api/watchlist        --> writes watchlist + market_source.add_ticker()
              +-- DELETE /api/watchlist/{ticker} --> deletes watchlist + market_source.remove_ticker()

app.state (module-level singletons)
     +-- price_cache: PriceCache        (shared with SSE stream + portfolio routes)
     +-- market_source: MarketDataSource (shared with lifespan + watchlist routes)
     +-- snapshot_task: asyncio.Task     (stored for cancellation on shutdown)

Background task: snapshot_loop()
     +-- every 30s: record_portfolio_snapshot(get_db_path(), price_cache)
     +-- reads positions from DB, looks up prices, writes to portfolio_snapshots
```

### Recommended Project Structure

```
backend/app/
├── state.py              # module-level singletons: price_cache, market_source, snapshot_task
├── main.py               # refactored: imports from state, registers new routers
├── api/
│   ├── __init__.py       # empty package marker
│   ├── portfolio.py      # portfolio + trading routes + record_portfolio_snapshot()
│   └── watchlist.py      # watchlist CRUD routes
├── db/
│   ├── __init__.py
│   └── init_db.py        # existing: get_db_path(), init_db()
└── market/               # existing: untouched by Phase 2
    └── ...
```

### Pattern 1: FastAPI Router with Prefix

The `prefix="/api"` is added at `include_router` time, not inside the router definition. This avoids the double-prefix bug that bit Phase 1 (stream router already had `/api/stream` prefix internally).

```python
# backend/app/api/portfolio.py
# Source: [VERIFIED: codebase - stream.py uses APIRouter(prefix=...) internally,
#          portfolio router does NOT set its own prefix]
from fastapi import APIRouter
router = APIRouter(tags=["portfolio"])

@router.get("/portfolio")
async def get_portfolio(): ...

@router.post("/portfolio/trade")
async def execute_trade(): ...

@router.get("/portfolio/history")
async def get_history(): ...
```

```python
# backend/app/main.py (after refactor)
from app.api.portfolio import router as portfolio_router
from app.api.watchlist import router as watchlist_router

app.include_router(portfolio_router, prefix="/api")
app.include_router(watchlist_router, prefix="/api")
# Result: /api/portfolio, /api/portfolio/trade, /api/watchlist, etc.
```

**Key lesson from Phase 1:** The stream router sets `prefix="/api/stream"` internally. New API routers must NOT set a prefix internally — they get `/api` added at include time. [VERIFIED: codebase - 01-02-SUMMARY.md deviation log]

### Pattern 2: app/state.py Module-Level Singletons

```python
# backend/app/state.py
# Source: [VERIFIED: codebase - main.py establishes this pattern]
import asyncio
from app.market import PriceCache, create_market_data_source

price_cache = PriceCache()
market_source = create_market_data_source(price_cache)
snapshot_task: asyncio.Task | None = None
```

Routes import directly:
```python
from app.state import price_cache, market_source
```

Lifespan in `main.py` calls `state.market_source.start(...)` / `state.market_source.stop()` and manages `state.snapshot_task`.

### Pattern 3: asyncio Background Task with Graceful Cancellation

The existing `SimulatorDataSource._run_loop()` provides the exact pattern to replicate: [VERIFIED: codebase - simulator.py lines 260-270]

```python
# snapshot_loop in main.py lifespan context
async def snapshot_loop():
    while True:
        try:
            record_portfolio_snapshot(get_db_path(), price_cache)
        except Exception:
            logger.exception("Snapshot failed")
        await asyncio.sleep(30)

# In lifespan startup:
import asyncio
import app.state as state
state.snapshot_task = asyncio.create_task(snapshot_loop(), name="snapshot-loop")

# In lifespan shutdown:
if state.snapshot_task and not state.snapshot_task.done():
    state.snapshot_task.cancel()
    try:
        await state.snapshot_task
    except asyncio.CancelledError:
        pass
```

`asyncio.CancelledError` must be caught after `await task` — it is raised by `task.cancel()` and propagated when awaited. [VERIFIED: Python stdlib docs / existing simulator.py pattern]

### Pattern 4: SQLite UPSERT for Positions

The `positions` table has `UNIQUE (user_id, ticker)`. Two options exist:

**Option A — UPDATE then INSERT (cleaner for weighted avg_cost):**
```python
# Source: [VERIFIED: codebase - init_db.py uses INSERT OR IGNORE pattern;
#          weighted avg requires reading existing values first]
with sqlite3.connect(db_path) as conn:
    existing = conn.execute(
        "SELECT quantity, avg_cost FROM positions WHERE user_id=? AND ticker=?",
        ("default", ticker)
    ).fetchone()

    if existing:
        old_qty, old_avg = existing
        new_qty = old_qty + trade_qty
        new_avg = (old_qty * old_avg + trade_qty * trade_price) / new_qty
        conn.execute(
            "UPDATE positions SET quantity=?, avg_cost=?, updated_at=? "
            "WHERE user_id=? AND ticker=?",
            (new_qty, new_avg, now, "default", ticker)
        )
    else:
        conn.execute(
            "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "default", ticker, trade_qty, trade_price, now)
        )
```

**Option B — INSERT OR REPLACE:** Replaces the entire row (loses the UUID primary key). Avoid — it's semantically wrong for an update and would need sub-query for avg_cost anyway.

**Recommendation: Option A.** The weighted avg_cost formula requires reading the existing values first regardless, so the SELECT + conditional UPDATE/INSERT is the natural flow. [ASSUMED: standard SQLite pattern — no specific Context7 reference needed; this is standard SQL logic]

### Pattern 5: Sell Logic and Position Cleanup

```python
# D-12: delete row when quantity reaches 0
with sqlite3.connect(db_path) as conn:
    existing = conn.execute(
        "SELECT quantity FROM positions WHERE user_id=? AND ticker=?",
        ("default", ticker)
    ).fetchone()
    # ... validation: existing and existing[0] >= sell_qty ...

    new_qty = existing[0] - sell_qty
    if new_qty == 0:
        conn.execute(
            "DELETE FROM positions WHERE user_id=? AND ticker=?",
            ("default", ticker)
        )
    else:
        conn.execute(
            "UPDATE positions SET quantity=?, updated_at=? WHERE user_id=? AND ticker=?",
            (new_qty, now, "default", ticker)
        )
```

### Pattern 6: Atomic Trade Transaction

Buy/sell must update `users_profile.cash_balance`, `positions`, and append to `trades` atomically. The `with sqlite3.connect(...) as conn:` context manager auto-commits on success and auto-rolls back on exception — this is the transaction boundary. [VERIFIED: codebase - init_db.py uses this pattern]

```python
with sqlite3.connect(db_path) as conn:
    # 1. Read cash balance
    # 2. Validate
    # 3. Update positions (UPSERT or DELETE)
    # 4. Update cash balance
    # 5. Append to trades
    # All in one with block = one transaction
```

### Pattern 7: Portfolio Response Construction

P&L is computed in Python, not SQL, because current prices come from `price_cache` (in-memory), not the database:

```python
# Source: [VERIFIED: codebase - CLAUDE.md documents PriceCache.get_all() and get_price()]
all_prices = price_cache.get_all()  # dict[str, PriceUpdate]

positions_rows = conn.execute(
    "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id=?",
    ("default",)
).fetchall()

positions_out = []
total_position_value = 0.0
for ticker, qty, avg_cost in positions_rows:
    price_update = all_prices.get(ticker)
    current_price = price_update.price if price_update else avg_cost  # fallback
    unrealized_pnl = (current_price - avg_cost) * qty
    position_value = current_price * qty
    total_position_value += position_value
    positions_out.append({
        "ticker": ticker,
        "quantity": qty,
        "avg_cost": avg_cost,
        "current_price": current_price,
        "unrealized_pnl": unrealized_pnl,
        "pnl_percent": ((current_price - avg_cost) / avg_cost * 100) if avg_cost else 0.0,
    })

cash = conn.execute(
    "SELECT cash_balance FROM users_profile WHERE id=?", ("default",)
).fetchone()[0]
total_value = cash + total_position_value
```

### Pattern 8: Watchlist Response with Prices

```python
# GET /api/watchlist — join DB rows with price_cache in Python
rows = conn.execute(
    "SELECT ticker FROM watchlist WHERE user_id=? ORDER BY added_at",
    ("default",)
).fetchall()

result = []
for (ticker,) in rows:
    price = price_cache.get_price(ticker)  # float | None
    result.append({"ticker": ticker, "price": price})
```

### Anti-Patterns to Avoid

- **Double-prefix router:** Do not set `prefix="/api"` inside the `APIRouter()` constructor for the new routers. Add it only at `app.include_router(..., prefix="/api")`. [VERIFIED: Phase 1 deviation log]
- **Fire-and-forget snapshot task without storing the reference:** `asyncio.create_task()` result must be stored (in `state.snapshot_task`) or the task may be garbage collected. [ASSUMED: standard asyncio gotcha]
- **Float equality for zero-check on quantity:** Use `new_qty <= 0` not `new_qty == 0` — fractional shares can produce floating-point rounding. [ASSUMED: defensive but correct for REAL column]
- **`INSERT OR REPLACE` for positions UPSERT:** Deletes and reinserts the row, breaks the weighted avg_cost formula flow, and wastes the UUID primary key.
- **Calling synchronous `record_portfolio_snapshot()` in a tight async loop:** The function uses `sqlite3.connect()` which is blocking. At single-user scale this is fine (SQLite WAL handles it); do not add `asyncio.to_thread()` — it's unnecessary complexity. [VERIFIED: CONTEXT.md "lean code" directive]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Request body parsing | Manual JSON decode | Pydantic `BaseModel` as route parameter |
| Status code on error | Manual Response() | `HTTPException(status_code=..., detail=...)` |
| UUID generation | Custom ID schemes | `str(uuid.uuid4())` — stdlib |
| ISO timestamp | Manual formatting | `datetime.now(timezone.utc).isoformat()` — stdlib |
| DB transaction rollback | Try/except with manual rollback | `with sqlite3.connect(...) as conn:` auto-rollback |

---

## Exact API Signatures from Existing Code

### PriceCache [VERIFIED: codebase - cache.py]

```python
price_cache.get_price(ticker: str) -> float | None
price_cache.get_all() -> dict[str, PriceUpdate]   # shallow copy, thread-safe
price_cache.get(ticker: str) -> PriceUpdate | None
price_cache.remove(ticker: str) -> None
```

`PriceUpdate` fields: `ticker`, `price`, `previous_price`, `timestamp`, `change`, `change_percent`, `direction` ("up"/"down"/"flat"), `to_dict()`.

### MarketDataSource [VERIFIED: codebase - interface.py]

```python
await market_source.add_ticker(ticker: str) -> None   # no-op if already present
await market_source.remove_ticker(ticker: str) -> None  # also removes from PriceCache
market_source.get_tickers() -> list[str]
await market_source.start(tickers: list[str]) -> None
await market_source.stop() -> None
```

### DB Helpers [VERIFIED: codebase - init_db.py]

```python
from app.db import get_db_path   # returns Path to db/finally.db
# Usage: sqlite3.connect(get_db_path())
```

---

## Common Pitfalls

### Pitfall 1: Double Prefix on New Routers
**What goes wrong:** Router defines `prefix="/api"` AND `include_router(..., prefix="/api")` → routes register at `/api/api/portfolio`.
**Why it happens:** Phase 1 stream router set its own prefix internally — new routers must not.
**How to avoid:** New routers use `APIRouter(tags=["portfolio"])` with no prefix. Prefix added only at `include_router` time.
**Warning signs:** Route inspection shows `/api/api/...` paths.

### Pitfall 2: snapshot_task Garbage Collection
**What goes wrong:** `asyncio.create_task(snapshot_loop())` without storing the result — CPython may GC the task.
**Why it happens:** `create_task` returns a Task object; if no reference is held, GC can cancel it.
**How to avoid:** Store in `state.snapshot_task = asyncio.create_task(...)`.

### Pitfall 3: CancelledError Not Awaited
**What goes wrong:** `task.cancel()` without `await task` — shutdown completes before task actually stops; may cause "Task was destroyed but it is pending" warning.
**How to avoid:** After `task.cancel()`, always `await task` and catch `asyncio.CancelledError`. Exact pattern from `SimulatorDataSource.stop()`. [VERIFIED: codebase - simulator.py]

### Pitfall 4: Blocking sqlite3 in Async Route Without `asyncio.to_thread`
**What goes wrong:** `sqlite3.connect()` is blocking I/O; in theory blocks the event loop.
**Reality:** At single-user scale with SQLite (local file, WAL mode not even required), this is a non-issue. Do NOT add `asyncio.to_thread()` complexity — the CONTEXT.md "lean code" directive applies.
**When it matters:** Only matters under concurrent load (multiple users). Out of scope.

### Pitfall 5: Selling Fractional Shares — Float Comparison
**What goes wrong:** `if new_qty == 0` fails for fractional shares due to float rounding (e.g., 0.1 + 0.2 ≠ 0.3).
**How to avoid:** Use `if new_qty <= 1e-9` or `round(new_qty, 8) == 0` for deletion check. Since the schema allows fractional shares, be defensive here.

### Pitfall 6: Missing Ticker in Price Cache on Trade
**What goes wrong:** Ticker is in DB watchlist but not yet in `price_cache` (e.g., server just started before first simulator tick).
**How to avoid:** `price_cache.get_price(ticker)` returns `None` → raise `HTTPException(503, detail="Price unavailable for {ticker}")`. D-13 locks this.

---

## Runtime State Inventory

Step 2.5 SKIPPED — Phase 2 is a greenfield addition (new routes + state refactor), not a rename/refactor/migration.

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Python 3.12+ | uv project | Must verify | Part of existing backend setup |
| FastAPI >=0.115.0 | router, HTTPException | Yes (pyproject.toml) | Already in dependencies |
| sqlite3 | all DB access | Yes (stdlib) | No install needed |
| asyncio | background task | Yes (stdlib) | No install needed |
| uuid | row IDs | Yes (stdlib) | No install needed |
| pytest + pytest-asyncio | tests | Yes (dev deps) | `uv run --extra dev pytest` |

No new dependencies needed for Phase 2.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.3.0 + pytest-asyncio 0.24.0 |
| Config file | `backend/pyproject.toml` (`[tool.pytest.ini_options]`) |
| Quick run command | `uv run --extra dev pytest tests/api/ -x -v` |
| Full suite command | `uv run --extra dev pytest -v` |
| asyncio_mode | `auto` (set in pyproject.toml) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | GET /api/portfolio returns positions + P&L | unit | `uv run --extra dev pytest tests/api/test_portfolio.py::test_get_portfolio -x` | Wave 0 |
| API-02 | POST /api/portfolio/trade executes buy/sell | unit | `uv run --extra dev pytest tests/api/test_portfolio.py::test_execute_trade -x` | Wave 0 |
| API-03 | GET /api/portfolio/history returns snapshots | unit | `uv run --extra dev pytest tests/api/test_portfolio.py::test_get_history -x` | Wave 0 |
| API-04 | GET /api/watchlist returns tickers + prices | unit | `uv run --extra dev pytest tests/api/test_watchlist.py::test_get_watchlist -x` | Wave 0 |
| API-05 | POST /api/watchlist adds ticker + syncs source | unit | `uv run --extra dev pytest tests/api/test_watchlist.py::test_add_ticker -x` | Wave 0 |
| API-06 | DELETE /api/watchlist/{ticker} removes + syncs | unit | `uv run --extra dev pytest tests/api/test_watchlist.py::test_remove_ticker -x` | Wave 0 |
| TRADE-01 | Trade fills at PriceCache price | unit | `uv run --extra dev pytest tests/api/test_portfolio.py::test_trade_uses_cache_price -x` | Wave 0 |
| TRADE-02 | Buy rejected if insufficient cash | unit | `uv run --extra dev pytest tests/api/test_portfolio.py::test_buy_insufficient_cash -x` | Wave 0 |
| TRADE-03 | Sell rejected if insufficient shares | unit | `uv run --extra dev pytest tests/api/test_portfolio.py::test_sell_insufficient_shares -x` | Wave 0 |
| TRADE-04 | avg_cost correct on buy; row deleted at qty=0 | unit | `uv run --extra dev pytest tests/api/test_portfolio.py::test_avg_cost_calculation -x` | Wave 0 |
| TRADE-05 | Snapshot recorded after trade | unit | `uv run --extra dev pytest tests/api/test_portfolio.py::test_snapshot_after_trade -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `uv run --extra dev pytest tests/api/ -x`
- **Per wave merge:** `uv run --extra dev pytest -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/api/__init__.py` — package marker
- [ ] `backend/tests/api/test_portfolio.py` — covers API-01, API-02, API-03, TRADE-01 through TRADE-05
- [ ] `backend/tests/api/test_watchlist.py` — covers API-04, API-05, API-06

**Test approach:** Use `tmp_path` fixture for DB (same pattern as `test_init_db.py`). Mock `PriceCache` and `MarketDataSource` to avoid simulator dependency. Tests call route functions directly with a patched DB path — no HTTP client needed for unit tests (though `TestClient` is also valid via FastAPI's test utilities).

---

## Security Domain

No auth, no multi-user, no secrets handling in Phase 2. Single default user hardcoded. All routes are localhost-only in development. No ASVS categories applicable to this phase's scope.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Option A (SELECT + UPDATE/INSERT) preferred over INSERT OR REPLACE for positions UPSERT | SQL Patterns | Low — either approach works; Option A is more readable for weighted avg |
| A2 | `float <= 1e-9` check for zero-quantity position deletion | Sell Logic | Low — could use `round(qty, 8) == 0` instead; either is correct |
| A3 | `asyncio.create_task` without stored reference may be GC'd | Pitfalls | Low — CPython usually keeps tasks alive, but storing is best practice |

---

## Sources

### Primary (HIGH confidence — verified from codebase)
- `backend/app/main.py` — lifespan pattern, module-level singletons, include_router usage
- `backend/app/market/simulator.py` — asyncio.create_task + cancel pattern (lines 229, 232-239, 260-270)
- `backend/app/market/cache.py` — PriceCache full API (get_price, get_all, get, remove)
- `backend/app/market/interface.py` — MarketDataSource abstract method signatures
- `backend/app/db/init_db.py` — sqlite3 context manager, INSERT OR IGNORE, get_db_path()
- `backend/CLAUDE.md` — PriceUpdate fields, PriceCache method list
- `.planning/phases/01-database-app-foundation/01-02-SUMMARY.md` — double-prefix bug and fix
- `.planning/phases/02-portfolio-trading-api/02-CONTEXT.md` — all 16 locked decisions

### Secondary (MEDIUM confidence — standard Python/FastAPI patterns)
- FastAPI `APIRouter` with prefix at include time: standard documented pattern [CITED: fastapi.tiangolo.com/tutorial/bigger-applications/]
- `asyncio.CancelledError` after `task.cancel()` + `await`: standard asyncio pattern [CITED: docs.python.org/3/library/asyncio-task.html]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from existing pyproject.toml and codebase
- Architecture: HIGH — patterns directly from existing code
- SQL patterns: HIGH — straightforward SQLite UPSERT; nothing exotic
- Pitfalls: HIGH — all verified from codebase or well-known Python behavior

**Research date:** 2026-05-15
**Valid until:** Stable — SQLite, FastAPI patterns don't change rapidly
