---
phase: 01-database-app-foundation
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/app/db/__init__.py
  - backend/app/db/init_db.py
  - backend/tests/db/test_init_db.py
  - backend/app/main.py
  - backend/pyproject.toml
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 1 delivers the SQLite DB module (`init_db.py`), its package init, the FastAPI app entrypoint (`main.py`), and corresponding unit tests. The schema design and idempotent seeding pattern are sound. However, there is one critical correctness bug: the schema DDL and seed data insertions run in separate implicit transactions due to `executescript`'s undocumented auto-commit behavior, leaving the database in a permanently broken state if initialization is interrupted at the right moment. There are also four warnings covering: the fragmented transaction, a post-top-level import ordering pattern that is fragile, module-level singleton instantiation that fires on every test import, and an unused import in the test file.

## Critical Issues

### CR-01: Schema and seed data are not atomic — partial init leaves DB permanently broken

**File:** `backend/app/db/init_db.py:30`

**Issue:** `sqlite3.executescript()` always issues an implicit `COMMIT` before executing its SQL. This means the DDL (table creation) is committed before the seed `INSERT OR IGNORE` statements run. If the process is killed, crashes, or raises an exception between the `executescript` call returning and the `conn.commit()` on line 95, the schema exists in the database but the default user and watchlist are absent.

On the next startup, `CREATE TABLE IF NOT EXISTS` silently succeeds (tables already exist), and `INSERT OR IGNORE` silently skips all rows (because no rows conflict — the table is empty). The result is a permanently empty database that passes initialization without error: no default user (`id='default'`), no watchlist entries. Any subsequent API call that reads `users_profile` or `watchlist` will return empty results or fail with a foreign-key-style logic error.

This is not a theoretical race — any unhandled exception raised within the `for ticker in DEFAULT_TICKERS` loop (e.g., a disk error, a DB lock, a corrupted uuid) triggers this path.

**Fix:** Wrap everything — DDL and DML — in a single explicit transaction using `conn.execute("BEGIN")` before `executescript`, or restructure to use `conn.executescript` for DDL only and run all inserts inside the same transaction with `executemany`. The simplest robust fix:

```python
def init_db(db_path: Path | None = None) -> None:
    if db_path is None:
        db_path = get_db_path()

    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    try:
        # executescript always issues an implicit COMMIT first; run DDL separately
        # then wrap seed data in an explicit transaction.
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users_profile ( ... );
            -- ... rest of schema ...
        """)
        # executescript has now auto-committed the schema.
        # Run seed inserts in a single explicit transaction.
        with conn:
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "INSERT OR IGNORE INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
                ("default", 10000.0, now),
            )
            conn.executemany(
                "INSERT OR IGNORE INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                [(str(uuid.uuid4()), "default", ticker, now) for ticker in DEFAULT_TICKERS],
            )
            # conn.__exit__ calls commit() on success, rollback() on exception
    finally:
        conn.close()
```

Using `with conn:` as a context manager gives automatic `COMMIT` on success and `ROLLBACK` on exception, making the seed inserts atomic.

## Warnings

### WR-01: Post-top-level imports are fragile and suppress linting

**File:** `backend/app/main.py:13-15`

**Issue:** Three imports (`init_db`, `PriceCache`, `create_market_data_source`, `create_stream_router`, `SEED_PRICES`) appear after executable code (`load_dotenv`) and carry `# noqa: E402` to suppress the linting violation. This works today because Python executes module-level statements in order. However, it creates a non-obvious invariant: if any future developer adds an import above line 11 (a completely normal refactor), or if a linter auto-sorts imports, `load_dotenv` may no longer run before `create_market_data_source` reads `MASSIVE_API_KEY`, silently switching from real market data to the simulator.

**Fix:** Move the `load_dotenv` call to an explicit initialization function called early in `lifespan()`, or place it in a dedicated `config.py` that is imported first:

```python
# config.py
from pathlib import Path
from dotenv import load_dotenv

def load_env() -> None:
    load_dotenv(Path(__file__).parent.parent.parent / ".env")
```

Then in `main.py`:
```python
# All imports at top
from app.config import load_env
from app.db import init_db
from app.market import PriceCache, create_market_data_source, create_stream_router
from app.market.seed_prices import SEED_PRICES

# Ensure env is loaded before factory reads it
load_env()
price_cache = PriceCache()
market_source = create_market_data_source(price_cache)
```

This makes the dependency explicit without suppressing lint.

### WR-02: Module-level singleton creation instantiates market source on every import

**File:** `backend/app/main.py:21-22`

**Issue:** `price_cache = PriceCache()` and `market_source = create_market_data_source(price_cache)` execute at module import time. Any code that imports from `app.main` — including pytest test collection — will instantiate a `SimulatorDataSource` or `MassiveDataSource`. If `MassiveDataSource.__init__` opens network connections or allocates resources, those leak in test environments. Even for the simulator, it creates objects that are never started or stopped in test contexts.

The comment "Module-level singletons so `create_stream_router` can be called at import time" documents the intent, but `create_stream_router` is also called at module level (line 38), meaning the router itself is bound to a specific `PriceCache` instance at import time. This makes the app harder to test in isolation.

**Fix:** Move singleton creation into the `lifespan` function and pass the cache to the router factory inside lifespan, or use FastAPI's dependency injection to provide these objects. At minimum, guard the singleton creation:

```python
# Accept the module-level pattern but document the test impact clearly,
# and ensure SimulatorDataSource.__init__ is cheap (no I/O, no threads).
```

If refactoring is not desired, verify that `SimulatorDataSource.__init__` and `MassiveDataSource.__init__` are side-effect-free (no threads, no sockets opened until `start()` is called). If they are, document this contract explicitly.

### WR-03: Exception during seed loop silently swallowed by `finally`

**File:** `backend/app/db/init_db.py:89-96`

**Issue:** The `try/finally` block (lines 29-97) closes the connection in `finally` but never calls `conn.rollback()` on exception. If an exception is raised inside the `for ticker in DEFAULT_TICKERS` loop (lines 89-93) — for example, a `sqlite3.OperationalError` — the exception propagates upward (correct), but the partially-executed inserts are silently abandoned without rollback. Python's sqlite3 module in auto-commit mode will leave any uncommitted writes in an ambiguous state.

Combined with CR-01 (executescript's implicit commit), an exception mid-loop means: schema is committed, some watchlist rows may or may not be committed depending on sqlite3's internal auto-begin state, and the error surfaces to the caller with no indication of how many rows were inserted.

**Fix:** Use `with conn:` as described in CR-01 to make the seed inserts transactional, or explicitly call `conn.rollback()` in an `except` block:

```python
conn = sqlite3.connect(db_path)
try:
    conn.executescript("...")   # DDL — auto-committed by executescript
    conn.execute("INSERT OR IGNORE INTO users_profile ...")
    for ticker in DEFAULT_TICKERS:
        conn.execute("INSERT OR IGNORE INTO watchlist ...")
    conn.commit()
except Exception:
    conn.rollback()
    raise
finally:
    conn.close()
```

### WR-04: Unused import `get_db_path` in test file

**File:** `backend/tests/db/test_init_db.py:7`

**Issue:** `get_db_path` is imported on line 7 (`from app.db import get_db_path, init_db`) but is never called or referenced in any test. This is a dead import — it neither exercises `get_db_path` nor contributes to the tests.

**Fix:** Either remove it from the import:
```python
from app.db import init_db
```
Or add a test that exercises `get_db_path`:
```python
def test_get_db_path_returns_absolute_path():
    path = get_db_path()
    assert path.is_absolute()
    assert path.name == "finally.db"
    assert path.parent.name == "db"
```
The second option is preferable since `get_db_path` is an exported public function with no test coverage.

## Info

### IN-01: `test_default_watchlist` hardcodes the count `10`

**File:** `backend/tests/db/test_init_db.py:44`

**Issue:** `assert len(rows) == 10` hardcodes the expected watchlist size. If `SEED_PRICES` is extended with new tickers (a likely future action), this assertion fails even though both the code and the data are correct.

**Fix:** Derive the expected count from the same source of truth used by the code:
```python
assert len(rows) == len(DEFAULT_TICKERS)
```

### IN-02: `litellm` absent from `pyproject.toml` dependencies

**File:** `backend/pyproject.toml:7-14`

**Issue:** The project plan (section 9) specifies LiteLLM for LLM integration. `litellm` is not yet present in dependencies. This is expected for Phase 1, but it is worth flagging to ensure it is added before the LLM integration phase rather than discovered at runtime.

**Fix:** Add when implementing the chat endpoint:
```toml
"litellm>=1.50.0",
```
This is informational — no action required in Phase 1.

---

_Reviewed: 2026-05-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
