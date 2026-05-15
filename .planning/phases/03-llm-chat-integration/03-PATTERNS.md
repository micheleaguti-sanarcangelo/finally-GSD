# Phase 3: LLM Chat Integration - Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 2 (1 new, 1 modified)
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/api/chat.py` | controller | request-response | `backend/app/api/portfolio.py` | exact |
| `backend/app/main.py` | config | request-response | `backend/app/main.py` (self) | exact |

---

## Pattern Assignments

### `backend/app/api/chat.py` (controller, request-response)

**Analog:** `backend/app/api/portfolio.py`

**Imports pattern** (portfolio.py lines 1-15, watchlist.py lines 1-13, cerebras SKILL.md):
```python
"""LLM chat API route."""

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter
from litellm import completion
from pydantic import BaseModel

import app.state as state
from app.api.portfolio import record_portfolio_snapshot
from app.db import get_db_path

router = APIRouter(tags=["chat"])

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
```

**Pydantic models pattern** — input request + structured LLM output (portfolio.py lines 18-28 as reference for request model; add LLM response models):
```python
class ChatRequest(BaseModel):
    message: str


class TradeAction(BaseModel):
    ticker: str
    side: str
    quantity: float


class WatchlistChange(BaseModel):
    ticker: str
    action: str


class LLMResponse(BaseModel):
    message: str
    trades: list[TradeAction] = []
    watchlist_changes: list[WatchlistChange] = []
```

**Mock detection pattern** (D-10 — inline at top of handler, not import-time):
```python
# Inside route handler:
if os.getenv("LLM_MOCK", "").lower() == "true":
    return {
        "message": "Mock: I'll buy 1 AAPL for you and add PYPL to your watchlist.",
        "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 1}],
        "watchlist_changes": [{"ticker": "PYPL", "action": "add"}],
        "actions_log": [],
    }
```

**sqlite3 context manager pattern** (portfolio.py lines 33-48, 55-62):
```python
with sqlite3.connect(get_db_path()) as conn:
    rows = conn.execute(
        "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id='default'"
    ).fetchall()
    cash_row = conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id='default'"
    ).fetchone()
```

**state singleton access pattern** (portfolio.py lines 54, 86; state.py lines 7-8):
```python
import app.state as state
# ...
prices = state.price_cache.get_all()
price = state.price_cache.get_price(ticker)
await state.market_source.add_ticker(ticker)
await state.market_source.remove_ticker(ticker)
```

**System prompt build pattern** (D-11 — portfolio context mirrors GET /api/portfolio logic from portfolio.py lines 51-79):
```python
def _build_system_prompt(db_path, cache) -> str:
    prices = cache.get_all()
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id='default'"
        ).fetchall()
        cash_row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id='default'"
        ).fetchone()
    cash = cash_row[0] if cash_row else 0.0
    position_value = 0.0
    positions_text = []
    for ticker, qty, avg_cost in rows:
        update = prices.get(ticker)
        current_price = update.price if update else avg_cost
        unrealized_pnl = (current_price - avg_cost) * qty
        pnl_percent = ((current_price - avg_cost) / avg_cost * 100) if avg_cost else 0.0
        position_value += current_price * qty
        positions_text.append(
            f"  {ticker}: {qty:.4g} shares @ avg ${avg_cost:.2f}, "
            f"current ${current_price:.2f}, P&L ${unrealized_pnl:.2f} ({pnl_percent:.1f}%)"
        )
    # ... watchlist with live prices, total value, system persona
```

**Conversation history query pattern** (D-03):
```python
with sqlite3.connect(get_db_path()) as conn:
    history = conn.execute(
        "SELECT role, content FROM chat_messages WHERE user_id='default' "
        "ORDER BY created_at ASC LIMIT 20"
    ).fetchall()
messages = [{"role": role, "content": content} for role, content in history]
```

**LiteLLM structured output call pattern** (cerebras SKILL.md):
```python
response = completion(
    model=MODEL,
    messages=messages,
    response_format=LLMResponse,
    reasoning_effort="low",
    extra_body=EXTRA_BODY,
)
result = LLMResponse.model_validate_json(response.choices[0].message.content)
```

**LLM failure fallback pattern** (D-01, D-02 — always HTTP 200):
```python
try:
    response = completion(...)
    result = LLMResponse.model_validate_json(response.choices[0].message.content)
except Exception:
    result = LLMResponse(
        message="I'm temporarily unavailable. Please try again.",
        trades=[],
        watchlist_changes=[],
    )
```

**Trade execution pattern for LLM-triggered trades** (D-04 — replicate portfolio.py lines 83-156 inline, collect results instead of raising HTTPException):
```python
actions_log = []
db_path = get_db_path()
now = datetime.now(timezone.utc).isoformat()

for trade in result.trades:
    ticker, side, quantity = trade.ticker.upper(), trade.side, trade.quantity
    price = state.price_cache.get_price(ticker)
    if price is None:
        actions_log.append(f"Trade failed {side} {quantity} {ticker}: price unavailable")
        continue
    try:
        with sqlite3.connect(db_path) as conn:
            conn.execute("BEGIN IMMEDIATE")
            cash_row = conn.execute(
                "SELECT cash_balance FROM users_profile WHERE id='default'"
            ).fetchone()
            cash = cash_row[0] if cash_row else 0.0
            pos_row = conn.execute(
                "SELECT quantity, avg_cost FROM positions WHERE user_id='default' AND ticker=?",
                (ticker,)
            ).fetchone()
            if side == "buy":
                cost = quantity * price
                if cash < cost:
                    actions_log.append(
                        f"Trade failed buy {quantity} {ticker}: insufficient cash "
                        f"(need ${cost:.2f}, have ${cash:.2f})"
                    )
                    continue
                # ... upsert position, deduct cash
            elif side == "sell":
                existing_qty = pos_row[0] if pos_row else 0.0
                if existing_qty < quantity:
                    actions_log.append(
                        f"Trade failed sell {quantity} {ticker}: "
                        f"only {existing_qty:.4g} shares held"
                    )
                    continue
                # ... update/delete position, add cash
            conn.execute(
                "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
                "VALUES (?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), "default", ticker, side, quantity, price, now),
            )
        actions_log.append(f"Executed {side} {quantity} {ticker} @ ${price:.2f}")
    except Exception as e:
        actions_log.append(f"Trade failed {side} {quantity} {ticker}: {e}")
```

**Watchlist mutation pattern for LLM-triggered changes** (D-06 — replicate watchlist.py lines 35-69, collect errors instead of raising HTTPException):
```python
for change in result.watchlist_changes:
    ticker = change.ticker.upper().strip()
    if change.action == "add":
        try:
            with sqlite3.connect(db_path) as conn:
                existing = conn.execute(
                    "SELECT id FROM watchlist WHERE user_id='default' AND ticker=?", (ticker,)
                ).fetchone()
                if existing:
                    actions_log.append(f"Watchlist: {ticker} already in watchlist")
                    continue
            await state.market_source.add_ticker(ticker)
            with sqlite3.connect(db_path) as conn:
                conn.execute(
                    "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, 'default', ?, ?)",
                    (str(uuid.uuid4()), ticker, datetime.now(timezone.utc).isoformat()),
                )
            actions_log.append(f"Watchlist: added {ticker}")
        except Exception as e:
            actions_log.append(f"Watchlist add failed {ticker}: {e}")
    elif change.action == "remove":
        # mirror of watchlist.py remove_ticker, collect error instead of raise
```

**Portfolio snapshot after all trades** (D-05 — from portfolio.py line 155):
```python
if result.trades:
    record_portfolio_snapshot(db_path, state.price_cache)
```

**chat_messages persistence pattern** (D-13 — store user message before LLM call, assistant after):
```python
now = datetime.now(timezone.utc).isoformat()
with sqlite3.connect(get_db_path()) as conn:
    conn.execute(
        "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
        "VALUES (?, 'default', 'user', ?, NULL, ?)",
        (str(uuid.uuid4()), req.message, now),
    )
# ... LLM call ...
with sqlite3.connect(get_db_path()) as conn:
    conn.execute(
        "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
        "VALUES (?, 'default', 'assistant', ?, ?, ?)",
        (
            str(uuid.uuid4()),
            result.message,
            json.dumps({"trades": [...], "watchlist_changes": [...]}),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
```

**Route handler signature** (D-07 — sync `def` is acceptable; FastAPI runs it in thread pool; watchlist.py uses `async def` because `await state.market_source.*` is needed — chat.py also calls those, so use `async def`):
```python
@router.post("/chat")
async def chat(req: ChatRequest):
    """Handle a chat message: build context, call LLM, execute actions, persist history."""
```

---

### `backend/app/main.py` (config, request-response)

**Analog:** `backend/app/main.py` (self — pattern already established)

**Router registration pattern** (main.py lines 62-64):
```python
# Existing pattern:
app.include_router(portfolio_router, prefix="/api")
app.include_router(watchlist_router, prefix="/api")

# Add after existing registrations (D-08):
from app.api.chat import router as chat_router
app.include_router(chat_router, prefix="/api")
```

**Import pattern** (main.py lines 16-17 show the established style):
```python
from app.api.portfolio import record_portfolio_snapshot, router as portfolio_router  # noqa: E402
from app.api.watchlist import router as watchlist_router  # noqa: E402
# New line:
from app.api.chat import router as chat_router  # noqa: E402
```

---

## Shared Patterns

### sqlite3 DB Access
**Source:** `backend/app/api/portfolio.py` lines 33-48, 55-62, 93-153
**Apply to:** `chat.py` for all DB reads/writes
```python
with sqlite3.connect(get_db_path()) as conn:
    # queries here — context manager handles commit/rollback
```
Use `conn.execute("BEGIN IMMEDIATE")` only when doing multi-step read-modify-write (as in trade execution).

### State Singleton Access
**Source:** `backend/app/state.py` lines 7-8; usage in `portfolio.py` line 54, `watchlist.py` line 10
**Apply to:** `chat.py`
```python
import app.state as state
# Attribute access (not from-import) for mock.patch compatibility
state.price_cache.get_price(ticker)
state.price_cache.get_all()
await state.market_source.add_ticker(ticker)
await state.market_source.remove_ticker(ticker)
```

### datetime/uuid Pattern
**Source:** `backend/app/api/portfolio.py` lines 3-4, 47-48
**Apply to:** `chat.py`
```python
import uuid
from datetime import datetime, timezone
# ...
str(uuid.uuid4())
datetime.now(timezone.utc).isoformat()
```

### LiteLLM Structured Output
**Source:** `.claude/skills/cerebras/SKILL.md`
**Apply to:** `chat.py` LLM call block
```python
from litellm import completion
MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

response = completion(
    model=MODEL,
    messages=messages,
    response_format=LLMResponse,
    reasoning_effort="low",
    extra_body=EXTRA_BODY,
)
result = LLMResponse.model_validate_json(response.choices[0].message.content)
```

### Always HTTP 200 (no HTTPException in chat)
**Source:** D-01 decision in CONTEXT.md
**Apply to:** `chat.py` — all error paths return a valid `LLMResponse`-shaped dict, never raise `HTTPException`.
This differs from `portfolio.py` and `watchlist.py` which raise `HTTPException` freely — `chat.py` must NOT do this.

---

## Dependency Note

`litellm` is not yet in `backend/pyproject.toml` (current deps: fastapi, uvicorn, numpy, massive, rich, python-dotenv). The executor must run `uv add litellm` from the `backend/` directory before implementing `chat.py`.

---

## No Analog Found

No files are without an analog — both files have direct codebase matches.

---

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/`, `backend/app/db/`, `.claude/skills/cerebras/`
**Files scanned:** 6 (portfolio.py, watchlist.py, state.py, init_db.py, main.py, cerebras SKILL.md)
**Pattern extraction date:** 2026-05-15
