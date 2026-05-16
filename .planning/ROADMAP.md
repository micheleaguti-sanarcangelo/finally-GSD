# Roadmap: FinAlly — AI Trading Workstation

**Project:** FinAlly  
**Started:** 2026-05-15  
**Mode:** YOLO (auto-approve)

---

## Completed

### Market Data Backend ✓
**Summary:** Full market data subsystem — GBM simulator, Massive API client, thread-safe price cache, SSE streaming endpoint, factory pattern. 73 tests, 84% coverage.  
**Artifacts:** `backend/app/market/` (8 modules), `backend/tests/market/` (6 test modules)

### Phase 1 — Database & App Foundation ✓ (2026-05-15)
**Summary:** SQLite lazy-init DB module (6 tables, idempotent seeding), FastAPI app entrypoint with lifespan, health endpoint, SSE router wiring. 78 tests passing.  
**Artifacts:** `backend/app/db/` (init module), `backend/app/main.py`, `backend/tests/db/` (5 tests)

### Phase 2 — Portfolio & Trading API ✓ (2026-05-15)
**Summary:** Full REST API for portfolio management, trade execution, and watchlist CRUD. Market orders with cash/share validation, avg_cost calculation, portfolio snapshot background task. 110 tests passing.  
**Artifacts:** `backend/app/api/portfolio.py`, `backend/app/api/watchlist.py`, `backend/tests/api/`

### Phase 3 — LLM Chat Integration ✓ (2026-05-16)
**Summary:** POST /api/chat pipeline with LiteLLM → OpenRouter → Cerebras (gpt-oss-120b), structured output, auto-execute trades and watchlist changes, LLM_MOCK mode, conversation history, 9 pytest tests. All 11 verification items + 2 human UAT tests passed.  
**Artifacts:** `backend/app/api/chat.py`, `backend/tests/api/test_chat.py`

---

## Completed (continued)

### Phase 4 — Frontend ✓ (2026-05-16)
**Summary:** Full Next.js trading terminal — all 8 components assembled in three-column layout, SSE live prices, portfolio tracking, AI chat, resizable columns. `npm run build` exits 0, frontend/out/ produced. All 10 UI requirements verified.  
**Artifacts:** `frontend/src/app/page.tsx`, `frontend/src/components/` (8 components), `frontend/src/hooks/useSSE.ts`

---

## Active Phases

### Phase 4 — Frontend ✓
**Goal:** Full trading terminal UI in Next.js — all panels functional, connected to the backend via SSE and REST.

**Scope:**
- Next.js TypeScript project with static export (`output: 'export'`)
- Tailwind CSS dark theme (bg `#0d1117`, accents per spec)
- Watchlist panel with price flash animations and sparklines
- Main chart area (Recharts AreaChart) for selected ticker
- Portfolio heatmap/treemap (positions by weight, colored by P&L)
- P&L line chart from `/api/portfolio/history`
- Positions table
- Trade bar (buy/sell market orders)
- AI chat panel with loading indicator and inline action confirmations
- Header with live total value, cash balance, connection status dot
- SSE `EventSource` with auto-reconnect

**Requirements:** UI-01 through UI-10

**Plans:** 5 plans

Plans:
- [x] 04-01-PLAN.md — Next.js scaffold, Tailwind config, Zustand price store, useSSE hook (COMPLETE 2026-05-16)
- [x] 04-02-PLAN.md — Header component + Watchlist panel with price flash and sparklines (COMPLETE 2026-05-16)
- [x] 04-03-PLAN.md — Trade bar + Positions table + Chat panel (COMPLETE 2026-05-16)
- [x] 04-04-PLAN.md — Main chart (AreaChart) + Portfolio heatmap (Treemap) + P&L chart (COMPLETE 2026-05-16)
- [x] 04-05-PLAN.md — Three-column layout assembly + final build verification (COMPLETE 2026-05-16)

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

**Plans:** 2 plans

Plans:
- [x] 05-01-PLAN.md — Multi-stage Dockerfile + FastAPI StaticFiles mount for Next.js export (COMPLETE 2026-05-16)
- [x] 05-02-PLAN.md — Start/stop scripts (Mac + Windows), docker-compose.yml, .env.example, .dockerignore (COMPLETE 2026-05-16)

**Success Criteria:**
- `./scripts/start_mac.sh` builds image and opens `http://localhost:8000`
- Fresh container start creates and seeds `db/finally.db` automatically
- Container restart preserves data via named volume
- `./scripts/stop_mac.sh` stops container cleanly

---

### Phase 6 — E2E Testing ✓ (2026-05-16)
**Goal:** Playwright test suite covering all 7 key user scenarios, runnable in CI via Docker.

**Scope:**
- `test/` directory with Playwright tests
- `test/docker-compose.test.yml` — app container + Playwright container
- All tests run with `LLM_MOCK=true`
- 7 scenarios: fresh start, watchlist CRUD, buy, sell, portfolio visualization, mocked chat, SSE reconnection

**Requirements:** TEST-01 through TEST-07

**Plans:** 2 plans

Plans:
- [x] 06-01-PLAN.md — Test infrastructure: package.json, playwright.config.ts, docker-compose.test.yml, data-testid additions to 4 components, frontend rebuild (COMPLETE 2026-05-16)
- [x] 06-02-PLAN.md — E2E test scenarios: test/tests/finally.spec.ts with all 7 scenarios TEST-01 through TEST-07 (COMPLETE 2026-05-16)

**Success Criteria:**
- `docker compose -f test/docker-compose.test.yml up --exit-code-from playwright` exits 0
- All 7 scenarios pass
- Tests run without a real OpenRouter API key (mock mode)

---

## Summary

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| ✓ | Market Data Backend | Market data, SSE, cache, tests | Complete |
| 1 | Database & App Foundation | DB-01–07, API-08 | Complete ✓ |
| 2 | Portfolio & Trading API | API-01–06, TRADE-01–05 | Complete ✓ |
| 3 | LLM Chat Integration | API-07, LLM-01–06 | Complete ✓ |
| 4 | Frontend | UI-01–10 | Complete ✓ |
| 5 | Docker & Deployment | INFRA-01–06 | Complete ✓ |
| 6 | E2E Testing | TEST-01–07 | Complete ✓ |
