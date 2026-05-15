"""Tests for watchlist API routes."""

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
    cache.get_price.side_effect = lambda t: {"AAPL": 190.0, "GOOGL": 175.0}.get(t)
    return cache


@pytest.fixture
def mock_source():
    source = AsyncMock()
    return source


@contextmanager
def _patched_client(db_path, mock_cache, mock_source):
    with patch("app.api.watchlist.get_db_path", return_value=db_path), \
         patch("app.state.price_cache", mock_cache), \
         patch("app.state.market_source", mock_source):
        from app.main import app
        with TestClient(app) as c:
            yield c
    import app.state as _state
    _state.snapshot_task = None


def test_get_watchlist(db_path, mock_cache, mock_source):
    with _patched_client(db_path, mock_cache, mock_source) as c:
        resp = c.get("/api/watchlist")
    assert resp.status_code == 200
    data = resp.json()
    assert "watchlist" in data
    assert len(data["watchlist"]) > 0
    item = data["watchlist"][0]
    assert "ticker" in item
    assert "price" in item


def test_get_watchlist_with_prices(db_path, mock_cache, mock_source):
    with _patched_client(db_path, mock_cache, mock_source) as c:
        resp = c.get("/api/watchlist")
    data = resp.json()
    tickers_with_price = {item["ticker"]: item["price"] for item in data["watchlist"]}
    assert tickers_with_price.get("AAPL") == pytest.approx(190.0)
    assert tickers_with_price.get("GOOGL") == pytest.approx(175.0)


def test_add_ticker(db_path, mock_cache, mock_source):
    with _patched_client(db_path, mock_cache, mock_source) as c:
        resp = c.post("/api/watchlist", json={"ticker": "PYPL"})
    assert resp.status_code == 200
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT ticker FROM watchlist WHERE ticker='PYPL' AND user_id='default'"
        ).fetchone()
    assert row is not None
    mock_source.add_ticker.assert_called_once_with("PYPL")


def test_add_ticker_duplicate(db_path, mock_cache, mock_source):
    with _patched_client(db_path, mock_cache, mock_source) as c:
        resp = c.post("/api/watchlist", json={"ticker": "AAPL"})
    assert resp.status_code == 400
    assert "already in watchlist" in resp.json()["detail"]


def test_remove_ticker(db_path, mock_cache, mock_source):
    with _patched_client(db_path, mock_cache, mock_source) as c:
        resp = c.delete("/api/watchlist/AAPL")
    assert resp.status_code == 200
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT ticker FROM watchlist WHERE ticker='AAPL' AND user_id='default'"
        ).fetchone()
    assert row is None
    mock_source.remove_ticker.assert_called_once_with("AAPL")


def test_remove_ticker_not_found(db_path, mock_cache, mock_source):
    with _patched_client(db_path, mock_cache, mock_source) as c:
        resp = c.delete("/api/watchlist/NOTREAL")
    assert resp.status_code == 404
