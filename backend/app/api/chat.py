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


def _build_system_prompt(db_path: str, cache) -> str:
    """Build system prompt with live portfolio context."""
    prices = cache.get_all()
    with sqlite3.connect(db_path) as conn:
        pos_rows = conn.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id='default'"
        ).fetchall()
        cash_row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id='default'"
        ).fetchone()
        watchlist_rows = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id='default' ORDER BY added_at"
        ).fetchall()
    cash = cash_row[0] if cash_row else 0.0
    position_value = 0.0
    positions_text = []
    for ticker, qty, avg_cost in pos_rows:
        update = prices.get(ticker)
        current_price = update.price if update else avg_cost
        unrealized_pnl = (current_price - avg_cost) * qty
        pnl_percent = ((current_price - avg_cost) / avg_cost * 100) if avg_cost else 0.0
        position_value += current_price * qty
        positions_text.append(
            f"  {ticker}: {qty:.4g} shares @ avg ${avg_cost:.2f}, "
            f"current ${current_price:.2f}, P&L ${unrealized_pnl:.2f} ({pnl_percent:.1f}%)"
        )
    total_value = cash + position_value
    watchlist_text = []
    for (ticker,) in watchlist_rows:
        price = cache.get_price(ticker)
        price_str = f"${price:.2f}" if price is not None else "N/A"
        watchlist_text.append(f"  {ticker}: {price_str}")

    positions_section = "\n".join(positions_text) if positions_text else "  (no positions)"
    watchlist_section = "\n".join(watchlist_text) if watchlist_text else "  (empty)"

    return (
        "You are FinAlly, an AI trading assistant. You analyze portfolios, suggest trades, "
        "and execute them when asked. Always respond with valid JSON matching the schema. "
        "Be concise and data-driven.\n\n"
        f"Portfolio:\n"
        f"  Cash: ${cash:.2f}\n"
        f"  Total value: ${total_value:.2f}\n"
        f"Positions:\n{positions_section}\n"
        f"Watchlist:\n{watchlist_section}\n\n"
        "Respond with JSON: {\"message\": \"...\", \"trades\": [], \"watchlist_changes\": []}\n"
        "trades items: {\"ticker\": \"AAPL\", \"side\": \"buy\", \"quantity\": 10}\n"
        "watchlist_changes items: {\"ticker\": \"PYPL\", \"action\": \"add\"} or {\"action\": \"remove\"}"
    )


@router.post("/chat")
async def chat(req: ChatRequest):
    """Handle a chat message: build context, call LLM, execute actions, persist history."""
    db_path = get_db_path()

    # D-10: mock check — skip LLM call, but still execute and persist
    if os.getenv("LLM_MOCK", "").lower() == "true":
        result = LLMResponse(
            message="Mock: I'll buy 1 AAPL for you and add PYPL to your watchlist.",
            trades=[TradeAction(ticker="AAPL", side="buy", quantity=1)],
            watchlist_changes=[WatchlistChange(ticker="PYPL", action="add")],
        )
    else:
        # D-13: persist user message before LLM call
        now = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
                "VALUES (?, 'default', 'user', ?, NULL, ?)",
                (str(uuid.uuid4()), req.message, now),
            )

        # D-03: load conversation history (last 20 messages)
        with sqlite3.connect(db_path) as conn:
            history = conn.execute(
                "SELECT role, content FROM chat_messages WHERE user_id='default' "
                "ORDER BY created_at ASC LIMIT 20"
            ).fetchall()

        # D-11: build system prompt with live portfolio context
        system_prompt = _build_system_prompt(db_path, state.price_cache)

        messages = (
            [{"role": "system", "content": system_prompt}]
            + [{"role": role, "content": content} for role, content in history]
            + [{"role": "user", "content": req.message}]
        )

        # D-01/D-02: LLM call with fallback on any failure
        try:
            response = completion(
                model=MODEL,
                messages=messages,
                response_format=LLMResponse,
                reasoning_effort="low",
                extra_body=EXTRA_BODY,
            )
            result = LLMResponse.model_validate_json(response.choices[0].message.content)
        except Exception:
            result = LLMResponse(
                message="I'm temporarily unavailable. Please try again.",
                trades=[],
                watchlist_changes=[],
            )

    # D-13: persist user message in mock mode too
    if os.getenv("LLM_MOCK", "").lower() == "true":
        now = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
                "VALUES (?, 'default', 'user', ?, NULL, ?)",
                (str(uuid.uuid4()), req.message, now),
            )

    actions_log: list[str] = []
    now = datetime.now(timezone.utc).isoformat()

    # D-04: execute trades independently, collect results
    for trade in result.trades:
        ticker = trade.ticker.upper().strip()
        side = trade.side
        quantity = trade.quantity
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
                    (ticker,),
                ).fetchone()

                if side == "buy":
                    cost = quantity * price
                    if cash < cost:
                        actions_log.append(
                            f"Trade failed buy {quantity} {ticker}: insufficient cash "
                            f"(need ${cost:.2f}, have ${cash:.2f})"
                        )
                        continue
                    if pos_row:
                        old_qty, old_avg = pos_row
                        new_qty = old_qty + quantity
                        new_avg = (old_qty * old_avg + quantity * price) / new_qty
                        conn.execute(
                            "UPDATE positions SET quantity=?, avg_cost=?, updated_at=? "
                            "WHERE user_id='default' AND ticker=?",
                            (new_qty, new_avg, now, ticker),
                        )
                    else:
                        conn.execute(
                            "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
                            "VALUES (?,?,?,?,?,?)",
                            (str(uuid.uuid4()), "default", ticker, quantity, price, now),
                        )
                    conn.execute(
                        "UPDATE users_profile SET cash_balance=? WHERE id='default'",
                        (cash - cost,),
                    )

                elif side == "sell":
                    existing_qty = pos_row[0] if pos_row else 0.0
                    if existing_qty < quantity:
                        actions_log.append(
                            f"Trade failed sell {quantity} {ticker}: "
                            f"only {existing_qty:.4g} shares held"
                        )
                        continue
                    new_qty = existing_qty - quantity
                    if new_qty <= 1e-9:
                        conn.execute(
                            "DELETE FROM positions WHERE user_id='default' AND ticker=?",
                            (ticker,),
                        )
                    else:
                        conn.execute(
                            "UPDATE positions SET quantity=?, updated_at=? "
                            "WHERE user_id='default' AND ticker=?",
                            (new_qty, now, ticker),
                        )
                    conn.execute(
                        "UPDATE users_profile SET cash_balance=? WHERE id='default'",
                        (cash + quantity * price,),
                    )

                conn.execute(
                    "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
                    "VALUES (?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), "default", ticker, side, quantity, price, now),
                )
            actions_log.append(f"Executed {side} {quantity} {ticker} @ ${price:.2f}")
        except Exception as exc:
            actions_log.append(f"Trade failed {side} {quantity} {ticker}: {exc}")

    # D-05: one portfolio snapshot after all trades
    if result.trades:
        record_portfolio_snapshot(db_path, state.price_cache)

    # D-06: watchlist changes independently, collect results
    for change in result.watchlist_changes:
        ticker = change.ticker.upper().strip()
        if change.action == "add":
            try:
                with sqlite3.connect(db_path) as conn:
                    existing = conn.execute(
                        "SELECT id FROM watchlist WHERE user_id='default' AND ticker=?",
                        (ticker,),
                    ).fetchone()
                    if existing:
                        actions_log.append(f"Watchlist: {ticker} already in watchlist")
                        continue
                await state.market_source.add_ticker(ticker)
                with sqlite3.connect(db_path) as conn:
                    conn.execute(
                        "INSERT INTO watchlist (id, user_id, ticker, added_at) "
                        "VALUES (?, 'default', ?, ?)",
                        (str(uuid.uuid4()), ticker, datetime.now(timezone.utc).isoformat()),
                    )
                actions_log.append(f"Watchlist: added {ticker}")
            except Exception as exc:
                actions_log.append(f"Watchlist add failed {ticker}: {exc}")
        elif change.action == "remove":
            try:
                with sqlite3.connect(db_path) as conn:
                    existing = conn.execute(
                        "SELECT id FROM watchlist WHERE user_id='default' AND ticker=?",
                        (ticker,),
                    ).fetchone()
                    if not existing:
                        actions_log.append(f"Watchlist: {ticker} not in watchlist")
                        continue
                await state.market_source.remove_ticker(ticker)
                with sqlite3.connect(db_path) as conn:
                    conn.execute(
                        "DELETE FROM watchlist WHERE user_id='default' AND ticker=?",
                        (ticker,),
                    )
                actions_log.append(f"Watchlist: removed {ticker}")
            except Exception as exc:
                actions_log.append(f"Watchlist remove failed {ticker}: {exc}")

    # D-04: append actions log to message
    if actions_log:
        result.message = result.message + "\n\n" + "\n".join(actions_log)

    # D-13: persist assistant message with actions JSON
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
            "VALUES (?, 'default', 'assistant', ?, ?, ?)",
            (
                str(uuid.uuid4()),
                result.message,
                json.dumps(
                    {
                        "trades": [t.model_dump() for t in result.trades],
                        "watchlist_changes": [w.model_dump() for w in result.watchlist_changes],
                    }
                ),
                datetime.now(timezone.utc).isoformat(),
            ),
        )

    return {
        "message": result.message,
        "trades": [t.model_dump() for t in result.trades],
        "watchlist_changes": [w.model_dump() for w in result.watchlist_changes],
    }
