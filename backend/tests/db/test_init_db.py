"""Unit tests for the DB initialization module."""

import sqlite3

import pytest

from app.db import get_db_path, init_db
from app.market.seed_prices import SEED_PRICES

EXPECTED_TABLES = {"users_profile", "watchlist", "positions", "trades", "portfolio_snapshots", "chat_messages"}
DEFAULT_TICKERS = set(SEED_PRICES.keys())


def test_creates_all_tables(tmp_path):
    """After init_db, all 6 tables exist in sqlite_master."""
    db_path = tmp_path / "test.db"
    init_db(db_path=db_path)
    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    conn.close()
    table_names = {row[0] for row in rows}
    assert table_names == EXPECTED_TABLES


def test_default_user(tmp_path):
    """users_profile has exactly 1 row: id='default', cash_balance=10000.0."""
    db_path = tmp_path / "test.db"
    init_db(db_path=db_path)
    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT id, cash_balance FROM users_profile").fetchall()
    conn.close()
    assert len(rows) == 1
    assert rows[0][0] == "default"
    assert rows[0][1] == 10000.0


def test_default_watchlist(tmp_path):
    """watchlist has 10 rows with user_id='default'; all 10 default tickers present."""
    db_path = tmp_path / "test.db"
    init_db(db_path=db_path)
    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT ticker, user_id FROM watchlist").fetchall()
    conn.close()
    assert len(rows) == 10
    assert all(row[1] == "default" for row in rows)
    assert {row[0] for row in rows} == DEFAULT_TICKERS


def test_idempotent(tmp_path):
    """Calling init_db twice does not raise and row counts remain the same."""
    db_path = tmp_path / "test.db"
    init_db(db_path=db_path)
    init_db(db_path=db_path)  # second call must not raise
    conn = sqlite3.connect(db_path)
    user_count = conn.execute("SELECT COUNT(*) FROM users_profile").fetchone()[0]
    watchlist_count = conn.execute("SELECT COUNT(*) FROM watchlist").fetchone()[0]
    conn.close()
    assert user_count == 1
    assert watchlist_count == 10


def test_creates_db_directory(tmp_path):
    """If db parent directory does not exist, init_db creates it."""
    db_path = tmp_path / "nested" / "dir" / "test.db"
    init_db(db_path=db_path)
    assert db_path.exists()
