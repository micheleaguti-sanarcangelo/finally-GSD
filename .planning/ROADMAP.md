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

### Phase 4 — Frontend ✓ (2026-05-16)
**Summary:** Full Next.js trading terminal — all 8 components assembled in three-column layout, SSE live prices, portfolio tracking, AI chat, resizable columns. `npm run build` exits 0, frontend/out/ produced. All 10 UI requirements verified.  
**Artifacts:** `frontend/src/app/page.tsx`, `frontend/src/components/` (8 components), `frontend/src/hooks/useSSE.ts`

### Phase 5 — Docker & Deployment ✓ (2026-05-16)
**Summary:** Multi-stage Dockerfile (Node 20 → Python 3.12), FastAPI static file serving, SQLite volume mount, start/stop scripts for Mac and Windows, docker-compose.yml, .env.example.  
**Artifacts:** `Dockerfile`, `scripts/` (4 scripts), `docker-compose.yml`, `.env.example`

### Phase 6 — E2E Testing ✓ (2026-05-16)
**Summary:** Playwright test suite covering all 7 key user scenarios, runnable in CI via Docker. docker-compose.test.yml with app + Playwright containers. All tests use LLM_MOCK=true.  
**Artifacts:** `test/` directory, `test/docker-compose.test.yml`, `test/tests/finally.spec.ts`

---

## Milestone v1.1 — Multilingual Chat

### Phases

- [ ] **Phase 7: Multilingual Chat** — Update AI system prompt so the LLM detects and matches user language automatically

### Phase Details

### Phase 7: Multilingual Chat
**Goal**: Users receive AI responses in whatever language they write in — language matching is automatic with no UI required
**Depends on**: Phase 3 (LLM Chat Integration — complete)
**Requirements**: CHAT-01, CHAT-02, CHAT-03
**Success Criteria** (what must be TRUE):
  1. User writes in Italian and the AI replies entirely in Italian, including trade confirmations
  2. User writes in French and the AI replies entirely in French
  3. User switches language mid-conversation and the AI matches the new language immediately
  4. No language selection UI exists — language matching happens transparently
**Plans**: TBD

---

## Progress Table (v1.1)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Multilingual Chat | 0/1 | Not started | - |

---

## Summary (v1.0 — all complete)

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| ✓ | Market Data Backend | Market data, SSE, cache, tests | Complete |
| 1 | Database & App Foundation | DB-01–07, API-08 | Complete ✓ |
| 2 | Portfolio & Trading API | API-01–06, TRADE-01–05 | Complete ✓ |
| 3 | LLM Chat Integration | API-07, LLM-01–06 | Complete ✓ |
| 4 | Frontend | UI-01–10 | Complete ✓ |
| 5 | Docker & Deployment | INFRA-01–06 | Complete ✓ |
| 6 | E2E Testing | TEST-01–07 | Complete ✓ |
