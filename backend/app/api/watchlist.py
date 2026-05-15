"""Watchlist CRUD API routes."""

import sqlite3
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import app.state as state
from app.db import get_db_path

router = APIRouter(tags=["watchlist"])


class AddTickerRequest(BaseModel):
    ticker: str


@router.get("/watchlist")
def get_watchlist():
    """Return all watched tickers with their latest prices."""
    with sqlite3.connect(get_db_path()) as conn:
        rows = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id='default' ORDER BY added_at"
        ).fetchall()
    return {
        "watchlist": [
            {"ticker": ticker, "price": state.price_cache.get_price(ticker)}
            for (ticker,) in rows
        ]
    }


@router.post("/watchlist")
async def add_ticker(req: AddTickerRequest):
    """Add a ticker to the watchlist and start tracking its price."""
    ticker = req.ticker.upper().strip()
    with sqlite3.connect(get_db_path()) as conn:
        existing = conn.execute(
            "SELECT id FROM watchlist WHERE user_id='default' AND ticker=?", (ticker,)
        ).fetchone()
        if existing:
            raise HTTPException(400, detail=f"Ticker {ticker} already in watchlist")
    await state.market_source.add_ticker(ticker)
    with sqlite3.connect(get_db_path()) as conn:
        conn.execute(
            "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, 'default', ?, ?)",
            (str(uuid.uuid4()), ticker, datetime.now(timezone.utc).isoformat()),
        )
    return {"status": "ok", "ticker": ticker}


@router.delete("/watchlist/{ticker}")
async def remove_ticker(ticker: str):
    """Remove a ticker from the watchlist and stop tracking its price."""
    ticker = ticker.upper().strip()
    with sqlite3.connect(get_db_path()) as conn:
        existing = conn.execute(
            "SELECT id FROM watchlist WHERE user_id='default' AND ticker=?", (ticker,)
        ).fetchone()
        if not existing:
            raise HTTPException(404, detail=f"Ticker {ticker} not in watchlist")
    await state.market_source.remove_ticker(ticker)
    with sqlite3.connect(get_db_path()) as conn:
        conn.execute(
            "DELETE FROM watchlist WHERE user_id='default' AND ticker=?", (ticker,)
        )
    return {"status": "ok", "ticker": ticker}
