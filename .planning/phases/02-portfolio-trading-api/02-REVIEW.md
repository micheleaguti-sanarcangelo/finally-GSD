---
phase: 02-portfolio-trading-api
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - backend/app/state.py
  - backend/app/api/__init__.py
  - backend/app/api/portfolio.py
  - backend/app/api/watchlist.py
  - backend/app/main.py
  - backend/tests/api/test_state.py
  - backend/tests/api/test_portfolio.py
  - backend/tests/api/test_watchlist.py
findings:
  critical: 2
  warning: 6
  info: 3
  total: 11
status: issues_found
verdict: FAIL
---

# Phase 02: Portfolio & Trading API — Code Review Report

**Reviewed:** 2026-05-15
**Depth:** standard
**Files Reviewed:** 7 (plus cross-referenced `backend/app/db/init_db.py`, `backend/app/market/simulator.py`, `backend/app/market/cache.py`)
**Verdict:** FAIL

## Summary

The Phase 2 implementation is structurally sound: routing, DB initialization, SSE integration, and the snapshot mechanism are coherent. However, two blocking defects exist in `execute_trade` that could cause incorrect financial state in the simulation: unvalidated `side` and `quantity` inputs allow silent no-op trades (with a trade record written) and negative-quantity exploits. There is also a startup divergence bug where dynamically added tickers are dropped on restart. Six warnings cover race conditions, incomplete patches in tests, and a non-atomic watchlist mutation. These must be resolved before this phase is considered shippable.

---

## Critical Issues

### CR-01: Missing `side` validation allows garbage trade records with no effect

**File:** `backend/app/api/portfolio.py:73-146`

**Issue:** `TradeRequest.side` is an unvalidated `str`. If a caller sends any value other than `"buy"` or `"sell"` (e.g., `"BUY"`, `"Buy"`, `"short"`, `""`), execution falls through both the `if side == "buy"` and `elif side == "sell"` branches. The code then unconditionally reaches the `INSERT INTO trades` statement at line 140 and calls `record_portfolio_snapshot` at line 145. The result is a trade record written to the DB with no cash or position change — a silent data integrity failure. A `side="BUY"` case (uppercase) is a particularly likely real-world mistake.

**Fix:**
```python
from pydantic import BaseModel, field_validator

class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str

    @field_validator("side")
    @classmethod
    def side_must_be_valid(cls, v: str) -> str:
        if v not in ("buy", "sell"):
            raise ValueError("side must be 'buy' or 'sell'")
        return v
```
Alternatively, use `side: Literal["buy", "sell"]` from `typing`:
```python
from typing import Literal
class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: Literal["buy", "sell"]
```
Pydantic will return a 422 with a clear error message for invalid values.

---

### CR-02: Missing `quantity` validation allows zero and negative trades

**File:** `backend/app/api/portfolio.py:73-146`

**Issue:** `TradeRequest.quantity` is `float` with no lower-bound constraint. Two exploits:

1. `quantity=0`: A buy with zero quantity passes the `cash < cost` check (`cost = 0 * price = 0.0`), inserts a position with 0 shares (or updates with no change), debits $0 cash, and writes a trade record. The trade record is a lie.

2. `quantity=-10` with `side="buy"`: `cost = -10 * price` is negative. `cash < cost` is `10000 < -1500` which is `False`, so the check is bypassed. `new_qty = old_qty + (-10)` creates a negative position. Cash is debited by a negative amount: `cash - (-1500) = cash + 1500` — the user gains cash from a "buy". This is a money-creation exploit in the simulation.

**Fix:**
```python
from pydantic import BaseModel, field_validator

class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: Literal["buy", "sell"]

    @field_validator("quantity")
    @classmethod
    def quantity_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v
```

---

## Warnings

### WR-01: Race condition in `execute_trade` — read-then-write without exclusive lock

**File:** `backend/app/api/portfolio.py:84-143`

**Issue:** The trade logic reads `cash_balance` and the position at lines 85-91, performs validation in Python, then writes back at lines 104-138. Although all of this happens inside a single `with sqlite3.connect(db_path) as conn:` block (which uses a single connection), SQLite's default isolation level is `""` (deferred). FastAPI runs sync routes in a thread pool, meaning two concurrent trade requests can each open a separate connection, both read the same `cash_balance = 10000`, both pass the `cash < cost` check independently, and both commit — overdrawing the account. SQLite does serialize writes, but the gap between the read and the write is not protected by an exclusive lock.

**Fix:** Begin an explicit exclusive or immediate transaction to lock the DB for the entire read-modify-write:
```python
with sqlite3.connect(db_path) as conn:
    conn.execute("BEGIN IMMEDIATE")
    cash_row = conn.execute(...).fetchone()
    # ... rest of trade logic ...
```
`BEGIN IMMEDIATE` acquires a reserved lock on first write and prevents other writers from entering, eliminating the race.

---

### WR-02: Startup uses `SEED_PRICES` keys instead of DB watchlist — dynamic tickers lost on restart

**File:** `backend/app/main.py:39`

**Issue:** On startup, the market source is initialized with `list(SEED_PRICES.keys())` — the hardcoded 10-ticker list. If a user has added a custom ticker via `POST /api/watchlist` (which persists to the DB), that ticker is in the `watchlist` table but is never passed to `market_source.start()` on the next container restart. The SSE stream will never emit prices for it, `get_price()` returns `None`, and the watchlist endpoint shows `"price": null` for it permanently.

**Fix:** Load the watchlist from the DB at startup and pass that list to `market_source.start()`:
```python
# In lifespan, after init_db():
with sqlite3.connect(get_db_path()) as conn:
    rows = conn.execute(
        "SELECT ticker FROM watchlist WHERE user_id='default'"
    ).fetchall()
tickers_to_track = [r[0] for r in rows] or list(SEED_PRICES.keys())
await state.market_source.start(tickers_to_track)
```

---

### WR-03: `add_ticker` and `remove_ticker` are not atomic — DB and price cache can diverge

**File:** `backend/app/api/watchlist.py:36-50` and `53-67`

**Issue:** In `add_ticker`, the DB insert commits at the end of the `with` block (line 48), then `await state.market_source.add_ticker(ticker)` is called at line 49. If the market source call raises (e.g., the simulator is not started yet), the ticker is in the DB but has no price. In `remove_ticker`, the DB delete commits at line 65, then `await state.market_source.remove_ticker(ticker)` at line 66. If that call fails, the ticker is gone from the DB but still tracked in the cache and pushed via SSE — ghost prices for a removed ticker.

**Fix:** Reverse the order: call `market_source` first, then commit to DB. If the market source call raises, no DB change has occurred:
```python
async def add_ticker(req: AddTickerRequest):
    ticker = req.ticker.upper().strip()
    # Check duplicate first (read-only)
    with sqlite3.connect(get_db_path()) as conn:
        existing = conn.execute(...).fetchone()
        if existing:
            raise HTTPException(400, ...)
    # Side-effectful call first; if it fails, no DB change
    await state.market_source.add_ticker(ticker)
    with sqlite3.connect(get_db_path()) as conn:
        conn.execute("INSERT INTO watchlist ...", ...)
    return {"status": "ok", "ticker": ticker}
```

---

### WR-04: Test portfolio client does not patch `market_source` — real simulator starts during tests

**File:** `backend/tests/api/test_portfolio.py:31-42`

**Issue:** `_patched_client` patches `app.state.price_cache` and `app.api.portfolio.get_db_path` but does not patch `app.state.market_source`. When `TestClient(app)` enters, `lifespan` runs and calls `await state.market_source.start(list(SEED_PRICES.keys()))` against the real `SimulatorDataSource`, starting a live `asyncio.Task` with a 500ms tick. This makes tests non-deterministic (live prices from the real simulator bleed into assertions), slow, and potentially interferes with the snapshot task patching. The `_patched_client` also does not patch `app.api.portfolio.get_db_path` used inside `record_portfolio_snapshot` — that function receives the path as a parameter so the patch does work, but the omission is fragile.

**Fix:** Add `app.state.market_source` mock to the portfolio test client:
```python
@contextmanager
def _patched_client(db_path, mock_cache):
    mock_source = AsyncMock()
    with patch("app.api.portfolio.get_db_path", return_value=db_path), \
         patch("app.main.get_db_path", return_value=db_path), \
         patch("app.state.price_cache", mock_cache), \
         patch("app.state.market_source", mock_source):
        from app.main import app
        with TestClient(app) as c:
            yield c
    import app.state as _state
    _state.snapshot_task = None
```

---

### WR-05: Test watchlist client does not patch `app.api.portfolio.get_db_path` — snapshot loop may hit production DB

**File:** `backend/tests/api/test_watchlist.py:33-43`

**Issue:** `_patched_client` patches `app.api.watchlist.get_db_path` and `app.state.*` but does not patch `app.api.portfolio.get_db_path` or `app.main.get_db_path`. The `snapshot_loop` background task (started in `lifespan`) calls `record_portfolio_snapshot(get_db_path(), ...)` where `get_db_path` is the unpatched version from `app.main`. This resolves to the production DB path (`db/finally.db`). If that file does not exist during the test run, the snapshot call will error silently (caught by `logger.exception`). If it does exist, the test is writing to the production DB. In CI this path almost certainly does not exist, so `snapshot_loop` will log exceptions on every 30-second tick.

**Fix:**
```python
@contextmanager
def _patched_client(db_path, mock_cache, mock_source):
    with patch("app.api.watchlist.get_db_path", return_value=db_path), \
         patch("app.api.portfolio.get_db_path", return_value=db_path), \
         patch("app.main.get_db_path", return_value=db_path), \
         patch("app.state.price_cache", mock_cache), \
         patch("app.state.market_source", mock_source):
        from app.main import app
        with TestClient(app) as c:
            yield c
    import app.state as _state
    _state.snapshot_task = None
```

---

### WR-06: `snapshot_loop` fires immediately at startup before the first trade — noisy baseline snapshot

**File:** `backend/app/main.py:25-31`

**Issue:** `snapshot_loop` has no initial delay. On startup it immediately calls `record_portfolio_snapshot` before the user has done anything. While `market_source.start()` does seed the price cache synchronously (so prices exist), the snapshot is written before any user activity. This is not incorrect per se, but it means the P&L history chart always has a data point at startup with total_value = $10,000 + (position values at seed prices). More importantly, in tests `test_snapshot_after_trade` asserts `count >= 1` — this passes vacuously even if the trade-triggered snapshot never fires, because the startup snapshot already satisfies the condition.

**Fix:** Add a short initial sleep or restructure the loop to sleep first:
```python
async def snapshot_loop() -> None:
    await asyncio.sleep(30)  # Don't record a snapshot on startup
    while True:
        try:
            record_portfolio_snapshot(get_db_path(), state.price_cache)
        except Exception:
            logger.exception("Snapshot failed")
        await asyncio.sleep(30)
```
Also tighten the test assertion to verify that the snapshot recorded after the trade reflects the trade's state.

---

## Info

### IN-01: `test_snapshot_after_trade` assertion is vacuous

**File:** `backend/tests/api/test_portfolio.py:148-153`

**Issue:** The test asserts `count >= 1`, but the startup snapshot (see WR-06) guarantees at least one row exists regardless of whether the trade-triggered snapshot fired. The test would pass even if `record_portfolio_snapshot` were never called from `execute_trade`.

**Fix:** Query the snapshot recorded after the trade and assert it reflects the new portfolio value (e.g., `total_value != 10000.0` after a buy at $150 for 1 share).

---

### IN-02: `test_record_portfolio_snapshot` asserts `row[0] > 0` — too weak

**File:** `backend/tests/api/test_portfolio.py:168-175`

**Issue:** The seeded user profile has `cash_balance = 10000.0` and no positions. `record_portfolio_snapshot` for this state should return exactly `10000.0`. The assertion `row[0] > 0` would pass even if the snapshot recorded `0.01`.

**Fix:**
```python
assert row[0] == pytest.approx(10000.0)
```

---

### IN-03: `app/api/__init__.py` is a blank file with no docstring

**File:** `backend/app/api/__init__.py:1`

**Issue:** The file is completely empty (0 bytes after the 1-line stub). Packages that are explicitly imported in tests (`test_api_package_importable`) should at minimum have a module docstring to document intent.

**Fix:** Add a one-line docstring:
```python
"""API route modules for the FinAlly backend."""
```

---

_Reviewed: 2026-05-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
