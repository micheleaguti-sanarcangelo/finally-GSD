"""Tests for chat API route."""

import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
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
    cache.get_all.return_value = {"AAPL": price_update, "PYPL": price_update}
    return cache


@contextmanager
def _patched_chat_client(db_path, mock_cache):
    """TestClient with db, cache, and market source patched to test fixtures."""
    import app.state as _state

    mock_source = AsyncMock()
    with (
        patch("app.api.chat.get_db_path", return_value=db_path),
        patch("app.api.portfolio.get_db_path", return_value=db_path),
        patch("app.api.watchlist.get_db_path", return_value=db_path),
        patch("app.main.get_db_path", return_value=db_path),
        patch("app.state.price_cache", mock_cache),
        patch("app.state.market_source", mock_source),
    ):
        from app.main import app

        with TestClient(app) as c:
            yield c
    _state.snapshot_task = None


def test_chat_mock_mode(db_path, mock_cache, monkeypatch):
    """LLM_MOCK=true returns 200 with Mock: message and correct shape."""
    monkeypatch.setenv("LLM_MOCK", "true")
    with _patched_chat_client(db_path, mock_cache) as c:
        resp = c.post("/api/chat", json={"message": "hello"})
    assert resp.status_code == 200
    data = resp.json()
    assert "message" in data
    assert "trades" in data
    assert "watchlist_changes" in data
    assert data["message"].startswith("Mock:")


def test_chat_mock_executes_trade(db_path, mock_cache, monkeypatch):
    """LLM_MOCK=true executes the mock trade (buy 1 AAPL) and inserts into trades table."""
    monkeypatch.setenv("LLM_MOCK", "true")
    with _patched_chat_client(db_path, mock_cache) as c:
        c.post("/api/chat", json={"message": "buy something"})
    with sqlite3.connect(db_path) as conn:
        count = conn.execute("SELECT COUNT(*) FROM trades").fetchone()[0]
    assert count > 0


def test_chat_mock_adds_watchlist(db_path, mock_cache, monkeypatch):
    """LLM_MOCK=true adds PYPL to watchlist table."""
    monkeypatch.setenv("LLM_MOCK", "true")
    with _patched_chat_client(db_path, mock_cache) as c:
        c.post("/api/chat", json={"message": "update watchlist"})
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT ticker FROM watchlist WHERE ticker='PYPL'"
        ).fetchone()
    assert row is not None
    assert row[0] == "PYPL"


def test_chat_llm_fallback(db_path, mock_cache):
    """When LLM raises, returns 200 with fallback message and empty trades/watchlist_changes."""
    with patch("app.api.chat.completion", side_effect=Exception("LLM down")):
        with _patched_chat_client(db_path, mock_cache) as c:
            resp = c.post("/api/chat", json={"message": "hello"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "I'm temporarily unavailable. Please try again."
    assert data["trades"] == []
    assert data["watchlist_changes"] == []


def test_chat_persists_user_message(db_path, mock_cache, monkeypatch):
    """User message is persisted in chat_messages before or after LLM response."""
    monkeypatch.setenv("LLM_MOCK", "true")
    with _patched_chat_client(db_path, mock_cache) as c:
        c.post("/api/chat", json={"message": "test message"})
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            "SELECT content FROM chat_messages WHERE role='user'"
        ).fetchall()
    contents = [r[0] for r in rows]
    assert any("test message" in c for c in contents)


def test_chat_persists_assistant_message(db_path, mock_cache, monkeypatch):
    """Assistant message is persisted in chat_messages after processing."""
    monkeypatch.setenv("LLM_MOCK", "true")
    with _patched_chat_client(db_path, mock_cache) as c:
        c.post("/api/chat", json={"message": "hello"})
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            "SELECT content FROM chat_messages WHERE role='assistant'"
        ).fetchall()
    assert len(rows) >= 1
    assert rows[0][0]  # non-empty content


def test_chat_history_included(db_path, mock_cache, monkeypatch):
    """Pre-existing conversation history does not break the call; new messages are appended."""
    monkeypatch.setenv("LLM_MOCK", "true")
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(db_path) as conn:
        for role, content in [
            ("user", "first message"),
            ("assistant", "first reply"),
            ("user", "second message"),
        ]:
            conn.execute(
                "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
                "VALUES (?, 'default', ?, ?, NULL, ?)",
                (str(uuid.uuid4()), role, content, now),
            )
    with _patched_chat_client(db_path, mock_cache) as c:
        resp = c.post("/api/chat", json={"message": "third message"})
    assert resp.status_code == 200
    with sqlite3.connect(db_path) as conn:
        count = conn.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0]
    # 3 pre-existing + 1 user + 1 assistant = 5 minimum
    assert count >= 5


def test_chat_insufficient_cash(db_path, mock_cache, monkeypatch):
    """LLM_MOCK=true with near-zero cash: trade fails, failure message appended to response."""
    monkeypatch.setenv("LLM_MOCK", "true")
    with sqlite3.connect(db_path) as conn:
        conn.execute("UPDATE users_profile SET cash_balance=0.01 WHERE id='default'")
    with _patched_chat_client(db_path, mock_cache) as c:
        resp = c.post("/api/chat", json={"message": "buy something"})
    assert resp.status_code == 200
    data = resp.json()
    assert "insufficient cash" in data["message"]
    assert data["trades"] == [{"ticker": "AAPL", "side": "buy", "quantity": 1.0}]


def test_chat_fallback_persists_messages(db_path, mock_cache):
    """Fallback path still persists both user and assistant messages."""
    with patch("app.api.chat.completion", side_effect=Exception("LLM down")):
        with _patched_chat_client(db_path, mock_cache) as c:
            c.post("/api/chat", json={"message": "failing message"})
    with sqlite3.connect(db_path) as conn:
        user_rows = conn.execute(
            "SELECT content FROM chat_messages WHERE role='user'"
        ).fetchall()
        assistant_rows = conn.execute(
            "SELECT content FROM chat_messages WHERE role='assistant'"
        ).fetchall()
    user_contents = [r[0] for r in user_rows]
    assert any("failing message" in c for c in user_contents)
    assert len(assistant_rows) >= 1
    assert assistant_rows[0][0] == "I'm temporarily unavailable. Please try again."
