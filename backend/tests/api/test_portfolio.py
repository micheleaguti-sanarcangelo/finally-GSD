"""Tests for portfolio API routes and trade logic."""

import sqlite3
from contextlib import contextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.db.init_db import init_db


@pytest.fixture
def db_path(tmp_path):
    path = tmp_path / "test.db"
    init_db(path)
    return path


@pytest.fixture
def mock_cache():
    cache = MagicMock()
    cache.get_price.return_value = 150.0
    price_update = MagicMock()
    price_update.price = 150.0
    cache.get_all.return_value = {"AAPL": price_update}
    return cache


@contextmanager
def _patched_client(db_path, mock_cache):
    """TestClient with db, cache, and market source patched to test fixtures."""
    import app.state as _state
    mock_source = AsyncMock()
    with patch("app.api.portfolio.get_db_path", return_value=db_path), \
         patch("app.main.get_db_path", return_value=db_path), \
         patch("app.state.price_cache", mock_cache), \
         patch("app.state.market_source", mock_source):
        from app.main import app
        with TestClient(app) as c:
            yield c
    _state.snapshot_task = None


def test_get_portfolio_empty(db_path, mock_cache):
    with _patched_client(db_path, mock_cache) as c:
        resp = c.get("/api/portfolio")
    assert resp.status_code == 200
    data = resp.json()
    assert data["positions"] == []
    assert data["cash_balance"] == pytest.approx(10000.0)


def test_get_portfolio(db_path, mock_cache):
    with sqlite3.connect(db_path) as conn:
        import uuid
        from datetime import datetime, timezone
        conn.execute(
            "INSERT OR REPLACE INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) VALUES (?,?,?,?,?,?)",
            (str(uuid.uuid4()), "default", "AAPL", 10.0, 100.0, datetime.now(timezone.utc).isoformat()),
        )
    with _patched_client(db_path, mock_cache) as c:
        resp = c.get("/api/portfolio")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["positions"]) == 1
    pos = data["positions"][0]
    assert pos["ticker"] == "AAPL"
    assert "unrealized_pnl" in pos
    assert "pnl_percent" in pos


def test_execute_buy(db_path, mock_cache):
    with _patched_client(db_path, mock_cache) as c:
        resp = c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 5.0, "side": "buy"})
    assert resp.status_code == 200
    with sqlite3.connect(db_path) as conn:
        row = conn.execute("SELECT quantity, avg_cost FROM positions WHERE ticker='AAPL'").fetchone()
    assert row is not None
    assert row[0] == pytest.approx(5.0)
    assert row[1] == pytest.approx(150.0)


def test_avg_cost_calculation(db_path, mock_cache):
    # trade1 price=100, snapshot1 price=100, trade2 price=120, snapshot2 price=120
    mock_cache.get_price.side_effect = [100.0, 100.0, 120.0, 120.0]
    with _patched_client(db_path, mock_cache) as c:
        c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 10.0, "side": "buy"})
        c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 5.0, "side": "buy"})
    with sqlite3.connect(db_path) as conn:
        row = conn.execute("SELECT quantity, avg_cost FROM positions WHERE ticker='AAPL'").fetchone()
    assert row[0] == pytest.approx(15.0)
    expected_avg = (10 * 100 + 5 * 120) / 15
    assert row[1] == pytest.approx(expected_avg, abs=0.01)


def test_execute_sell(db_path, mock_cache):
    with _patched_client(db_path, mock_cache) as c:
        c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 10.0, "side": "buy"})
        resp = c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 3.0, "side": "sell"})
    assert resp.status_code == 200
    with sqlite3.connect(db_path) as conn:
        row = conn.execute("SELECT quantity FROM positions WHERE ticker='AAPL'").fetchone()
    assert row[0] == pytest.approx(7.0)


def test_sell_full_position(db_path, mock_cache):
    with _patched_client(db_path, mock_cache) as c:
        c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 5.0, "side": "buy"})
        resp = c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 5.0, "side": "sell"})
    assert resp.status_code == 200
    with sqlite3.connect(db_path) as conn:
        row = conn.execute("SELECT quantity FROM positions WHERE ticker='AAPL'").fetchone()
    assert row is None


def test_buy_insufficient_cash(db_path, mock_cache):
    mock_cache.get_price.return_value = 1000.0
    with _patched_client(db_path, mock_cache) as c:
        resp = c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 100.0, "side": "buy"})
    assert resp.status_code == 400
    assert "Insufficient cash" in resp.json()["detail"]


def test_sell_insufficient_shares(db_path, mock_cache):
    with _patched_client(db_path, mock_cache) as c:
        c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 5.0, "side": "buy"})
        resp = c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 10.0, "side": "sell"})
    assert resp.status_code == 400
    assert "Insufficient shares" in resp.json()["detail"]


def test_trade_uses_cache_price(db_path, mock_cache):
    mock_cache.get_price.return_value = 200.0
    with _patched_client(db_path, mock_cache) as c:
        c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1.0, "side": "buy"})
    with sqlite3.connect(db_path) as conn:
        row = conn.execute("SELECT price FROM trades WHERE ticker='AAPL'").fetchone()
    assert row[0] == pytest.approx(200.0)


def test_price_unavailable_503(db_path, mock_cache):
    mock_cache.get_price.return_value = None
    with _patched_client(db_path, mock_cache) as c:
        resp = c.post("/api/portfolio/trade", json={"ticker": "XYZ", "quantity": 1.0, "side": "buy"})
    assert resp.status_code == 503


def test_snapshot_after_trade(db_path, mock_cache):
    with _patched_client(db_path, mock_cache) as c:
        c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1.0, "side": "buy"})
    with sqlite3.connect(db_path) as conn:
        count = conn.execute("SELECT COUNT(*) FROM portfolio_snapshots").fetchone()[0]
    assert count >= 2  # startup snapshot + trade snapshot


def test_get_history(db_path, mock_cache):
    with _patched_client(db_path, mock_cache) as c:
        c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1.0, "side": "buy"})
        resp = c.get("/api/portfolio/history")
    assert resp.status_code == 200
    data = resp.json()
    assert "history" in data
    assert len(data["history"]) >= 1
    assert "total_value" in data["history"][0]
    assert "recorded_at" in data["history"][0]


def test_record_portfolio_snapshot(db_path, mock_cache):
    from app.api.portfolio import record_portfolio_snapshot
    mock_cache.get_price.return_value = 150.0
    record_portfolio_snapshot(db_path, mock_cache)
    with sqlite3.connect(db_path) as conn:
        row = conn.execute("SELECT total_value FROM portfolio_snapshots").fetchone()
    assert row is not None
    assert row[0] == pytest.approx(10000.0)
