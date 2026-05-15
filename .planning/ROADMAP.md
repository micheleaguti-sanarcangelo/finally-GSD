# Roadmap: FinAlly — AI Trading Workstation

**Project:** FinAlly  
**Started:** 2026-05-15  
**Mode:** YOLO (auto-approve)

---

## Completed

### Market Data Backend ✓
**Summary:** Full market data subsystem — GBM simulator, Massive API client, thread-safe price cache, SSE streaming endpoint, factory pattern. 73 tests, 84% coverage.  
**Artifacts:** `backend/app/market/` (8 modules), `backend/tests/market/` (6 test modules)

---

## Active Phases

### Phase 1 — Database & App Foundation
**Goal:** FastAPI app starts up, initializes SQLite lazily, integrates the existing market data module, and exposes a working health endpoint and SSE stream.

**Scope:**
- FastAPI application entrypoint with lifespan startup (market data source + price cache)
- SQLite lazy initialization: create 6 tables + seed default data on first start
- `GET /api/health` endpoint
- Wire existing `create_stream_router()` into FastAPI app
- App configuration via environment variables (MASSIVE_API_KEY, LLM_MOCK)

**Requirements:** DB-01 through DB-07, API-08

**Success Criteria:**
- `uv run uvicorn app.main:app` starts without error
- `GET /api/health` returns `{"status": "ok"}`
- `GET /api/stream/prices` streams price updates for all 10 default tickers
- Fresh `db/finally.db` is created with all tables and seed data on first run
- Existing market data tests still pass

---

### Phase 2 — Portfolio & Trading API
**Goal:** Full REST API for portfolio management, trade execution, and watchlist CRUD — the complete backend minus chat.

**Scope:**
- Trade execution: market orders, cash/share validation, avg_cost calculation
- `GET /api/portfolio`, `POST /api/portfolio/trade`, `GET /api/portfolio/history`
- `GET /api/watchlist`, `POST /api/watchlist`, `DELETE /api/watchlist/{ticker}`
- Portfolio snapshot background task (every 30s + after each trade)
- Watchlist changes propagate to market data source (add/remove tickers from price tracking)

**Requirements:** API-01 through API-06, TRADE-01 through TRADE-05

**Success Criteria:**
- Can buy 10 AAPL shares via `POST /api/portfolio/trade`; cash decreases, position appears in `GET /api/portfolio`
- Sell validation rejects selling more than owned
- Buy validation rejects insufficient cash
- `GET /api/portfolio/history` returns snapshot entries accumulating over time
- Adding a ticker via `POST /api/watchlist` starts streaming its price
- Backend unit tests cover trade logic and P&L calculations

---

### Phase 3 — LLM Chat Integration
**Goal:** AI chat endpoint that understands portfolio context, returns structured JSON, auto-executes trades and watchlist changes, and supports mock mode.

**Scope:**
- `POST /api/chat` — full pipeline: load context → history → call LLM → parse → execute → store → return
- LiteLLM → OpenRouter → Cerebras (`openrouter/openai/gpt-oss-120b`) with structured outputs
- Structured output schema: `{message, trades[], watchlist_changes[]}`
- System prompt with live portfolio context (cash, positions with P&L, watchlist prices)
- Auto-execute trades and watchlist changes from response
- `LLM_MOCK=true` deterministic mock response
- Conversation history from `chat_messages` table

**Requirements:** API-07, LLM-01 through LLM-06

**Success Criteria:**
- `POST /api/chat {"message": "buy 5 AAPL"}` returns structured JSON and executes the trade
- `LLM_MOCK=true` returns consistent mock response without calling OpenRouter
- Failed trades (insufficient cash) are reported in the response message
- Conversation history is maintained across multiple chat calls

---

### Phase 4 — Frontend
**Goal:** Full trading terminal UI in Next.js — all panels functional, connected to the backend via SSE and REST.

**Scope:**
- Next.js TypeScript project with static export (`output: 'export'`)
- Tailwind CSS dark theme (bg `#0d1117`, accents per spec)
- Watchlist panel with price flash animations and sparklines
- Main chart area (Lightweight Charts or Recharts) for selected ticker
- Portfolio heatmap/treemap (positions by weight, colored by P&L)
- P&L line chart from `/api/portfolio/history`
- Positions table
- Trade bar (buy/sell market orders)
- AI chat panel with loading indicator and inline action confirmations
- Header with live total value, cash balance, connection status dot
- SSE `EventSource` with auto-reconnect

**Requirements:** UI-01 through UI-10

**Success Criteria:**
- `npm run build` produces static export with no errors
- Browser shows live-updating prices with green/red flash animations
- Clicking a ticker in watchlist updates main chart
- Buy 10 shares from trade bar: cash and positions update instantly
- Chat panel sends message, shows loading state, renders response with trade confirmation
- Connection status dot turns yellow on disconnect, green on reconnect

---

### Phase 5 — Docker & Deployment
**Goal:** Single `docker run` command launches the complete app; start/stop scripts work on Mac and Windows.

**Scope:**
- Multi-stage Dockerfile: Node 20 slim (Next.js build) → Python 3.12 slim (uv + FastAPI + static files)
- FastAPI serves `frontend/out/` as static files at `/*`
- SQLite volume mount at `/app/db`
- `scripts/start_mac.sh`, `scripts/stop_mac.sh`
- `scripts/start_windows.ps1`, `scripts/stop_windows.ps1`
- `docker-compose.yml` optional convenience wrapper
- `.env.example` with placeholder values

**Requirements:** INFRA-01 through INFRA-06

**Success Criteria:**
- `./scripts/start_mac.sh` builds image and opens `http://localhost:8000`
- Fresh container start creates and seeds `db/finally.db` automatically
- Container restart preserves data via named volume
- `./scripts/stop_mac.sh` stops container cleanly

---

### Phase 6 — E2E Testing
**Goal:** Playwright test suite covering all 7 key user scenarios, runnable in CI via Docker.

**Scope:**
- `test/` directory with Playwright tests
- `test/docker-compose.test.yml` — app container + Playwright container
- All tests run with `LLM_MOCK=true`
- 7 scenarios: fresh start, watchlist CRUD, buy, sell, portfolio visualization, mocked chat, SSE reconnection

**Requirements:** TEST-01 through TEST-07

**Success Criteria:**
- `docker compose -f test/docker-compose.test.yml up --exit-code-from playwright` exits 0
- All 7 scenarios pass
- Tests run without a real OpenRouter API key (mock mode)

---

## Summary

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| ✓ | Market Data Backend | Market data, SSE, cache, tests | Complete |
| 1 | Database & App Foundation | DB-01–07, API-08 | Pending |
| 2 | Portfolio & Trading API | API-01–06, TRADE-01–05 | Pending |
| 3 | LLM Chat Integration | API-07, LLM-01–06 | Pending |
| 4 | Frontend | UI-01–10 | Pending |
| 5 | Docker & Deployment | INFRA-01–06 | Pending |
| 6 | E2E Testing | TEST-01–07 | Pending |
