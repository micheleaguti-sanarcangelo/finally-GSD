"""Portfolio and trading API routes."""

import sqlite3
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import app.state as state
from app.db import get_db_path

router = APIRouter(tags=["portfolio"])


class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str


def record_portfolio_snapshot(db_path, cache) -> None:
    """Insert a portfolio value snapshot into portfolio_snapshots."""
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id='default'"
        ).fetchall()
        cash_row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id='default'"
        ).fetchone()
        cash = cash_row[0] if cash_row else 0.0
        total = cash + sum(
            qty * (cache.get_price(ticker) or avg_cost)
            for ticker, qty, avg_cost in rows
        )
        conn.execute(
            "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), "default", total, datetime.now(timezone.utc).isoformat()),
        )


@router.get("/portfolio")
def get_portfolio():
    """Return current positions with live P&L, cash balance, and total value."""
    prices = state.price_cache.get_all()
    with sqlite3.connect(get_db_path()) as conn:
        rows = conn.execute(
            "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id='default'"
        ).fetchall()
        cash_row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id='default'"
        ).fetchone()
    cash = cash_row[0] if cash_row else 0.0
    positions = []
    position_value = 0.0
    for ticker, qty, avg_cost in rows:
        update = prices.get(ticker)
        current_price = update.price if update else avg_cost
        unrealized_pnl = (current_price - avg_cost) * qty
        pnl_percent = ((current_price - avg_cost) / avg_cost * 100) if avg_cost else 0.0
        position_value += current_price * qty
        positions.append({
            "ticker": ticker,
            "quantity": qty,
            "avg_cost": avg_cost,
            "current_price": current_price,
            "unrealized_pnl": unrealized_pnl,
            "pnl_percent": pnl_percent,
        })
    return {"positions": positions, "cash_balance": cash, "total_value": cash + position_value}


@router.post("/portfolio/trade")
def execute_trade(req: TradeRequest):
    """Execute a buy or sell market order."""
    ticker, quantity, side = req.ticker, req.quantity, req.side
    price = state.price_cache.get_price(ticker)
    if price is None:
        raise HTTPException(503, detail=f"Price unavailable for {ticker}")

    now = datetime.now(timezone.utc).isoformat()
    db_path = get_db_path()

    with sqlite3.connect(db_path) as conn:
        cash_row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id='default'"
        ).fetchone()
        cash = cash_row[0] if cash_row else 0.0
        pos_row = conn.execute(
            "SELECT quantity, avg_cost FROM positions WHERE user_id='default' AND ticker=?", (ticker,)
        ).fetchone()

        if side == "buy":
            cost = quantity * price
            if cash < cost:
                raise HTTPException(
                    400,
                    detail=f"Insufficient cash: need ${cost:.2f}, have ${cash:.2f}",
                )
            if pos_row:
                old_qty, old_avg = pos_row
                new_qty = old_qty + quantity
                new_avg = (old_qty * old_avg + quantity * price) / new_qty
                conn.execute(
                    "UPDATE positions SET quantity=?, avg_cost=?, updated_at=? WHERE user_id='default' AND ticker=?",
                    (new_qty, new_avg, now, ticker),
                )
            else:
                conn.execute(
                    "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) VALUES (?,?,?,?,?,?)",
                    (str(uuid.uuid4()), "default", ticker, quantity, price, now),
                )
            conn.execute(
                "UPDATE users_profile SET cash_balance=? WHERE id='default'",
                (cash - cost,),
            )

        elif side == "sell":
            existing_qty = pos_row[0] if pos_row else 0.0
            if existing_qty < quantity:
                raise HTTPException(
                    400,
                    detail=f"Insufficient shares: have {existing_qty:.4g}, selling {quantity:.4g}",
                )
            new_qty = existing_qty - quantity
            if new_qty <= 1e-9:
                conn.execute(
                    "DELETE FROM positions WHERE user_id='default' AND ticker=?", (ticker,)
                )
            else:
                conn.execute(
                    "UPDATE positions SET quantity=?, updated_at=? WHERE user_id='default' AND ticker=?",
                    (new_qty, now, ticker),
                )
            conn.execute(
                "UPDATE users_profile SET cash_balance=? WHERE id='default'",
                (cash + quantity * price,),
            )

        conn.execute(
            "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), "default", ticker, side, quantity, price, now),
        )

    record_portfolio_snapshot(db_path, state.price_cache)
    return {"status": "ok", "ticker": ticker, "side": side, "quantity": quantity, "price": price}


@router.get("/portfolio/history")
def get_portfolio_history():
    """Return portfolio value snapshots ordered by time."""
    with sqlite3.connect(get_db_path()) as conn:
        rows = conn.execute(
            "SELECT total_value, recorded_at FROM portfolio_snapshots WHERE user_id='default' ORDER BY recorded_at ASC"
        ).fetchall()
    return {"history": [{"total_value": r[0], "recorded_at": r[1]} for r in rows]}
