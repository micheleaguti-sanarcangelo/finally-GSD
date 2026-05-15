"""SQLite database initialization: schema creation and seed data."""

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.market.seed_prices import SEED_PRICES

DEFAULT_TICKERS = list(SEED_PRICES.keys())


def get_db_path() -> Path:
    """Return the absolute path to the SQLite database file."""
    return Path(__file__).parent.parent.parent.parent / "db" / "finally.db"


def init_db(db_path: Path | None = None) -> None:
    """Create all tables and seed default data if not already present.

    Safe to call multiple times — uses CREATE TABLE IF NOT EXISTS and INSERT OR IGNORE.
    """
    if db_path is None:
        db_path = get_db_path()

    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users_profile (
                id TEXT PRIMARY KEY,
                cash_balance REAL NOT NULL DEFAULT 10000.0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS watchlist (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT 'default',
                ticker TEXT NOT NULL,
                added_at TEXT NOT NULL,
                UNIQUE (user_id, ticker)
            );

            CREATE TABLE IF NOT EXISTS positions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT 'default',
                ticker TEXT NOT NULL,
                quantity REAL NOT NULL,
                avg_cost REAL NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE (user_id, ticker)
            );

            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT 'default',
                ticker TEXT NOT NULL,
                side TEXT NOT NULL,
                quantity REAL NOT NULL,
                price REAL NOT NULL,
                executed_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT 'default',
                total_value REAL NOT NULL,
                recorded_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT 'default',
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                actions TEXT,
                created_at TEXT NOT NULL
            );
        """)

        now = datetime.now(timezone.utc).isoformat()

        conn.execute(
            "INSERT OR IGNORE INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
            ("default", 10000.0, now),
        )

        for ticker in DEFAULT_TICKERS:
            conn.execute(
                "INSERT OR IGNORE INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                (str(uuid.uuid4()), "default", ticker, now),
            )

        conn.commit()
    finally:
        conn.close()
