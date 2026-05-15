# FinAlly — AI Trading Workstation

## What This Is

FinAlly (Finance Ally) is a Bloomberg-terminal-inspired AI trading workstation. Users watch live-streaming prices for a configurable watchlist, trade a simulated $10k portfolio with market orders, and chat with an LLM assistant that analyzes positions and executes trades on command. Built as the capstone for an agentic AI coding course — the entire platform is built by orchestrated AI agents.

## Core Value

A single Docker command launches a fully functional trading terminal with live prices, portfolio tracking, and an AI copilot that executes trades on command.

## Requirements

### Validated
- ✓ Market data simulator (GBM with Cholesky-correlated moves, random shock events)
- ✓ Massive API client (Polygon.io REST poller) via `massive` package
- ✓ Thread-safe price cache (`PriceCache`) with version counter for SSE change detection
- ✓ SSE streaming endpoint (`/api/stream/prices`) with EventSource-compatible format
- ✓ Factory pattern selecting simulator vs. Massive based on `MASSIVE_API_KEY` env var
- ✓ Abstract `MarketDataSource` interface (strategy pattern)
- ✓ 73 passing tests, 84% coverage across 6 test modules

### Active
- [ ] SQLite lazy initialization (6 tables, seed data on fresh start)
- [ ] Portfolio & trading REST API (positions, cash, P&L, trade execution)
- [ ] Watchlist CRUD API
- [ ] Portfolio snapshot background task (every 30s + after each trade)
- [ ] LLM chat with structured output (message + trades[] + watchlist_changes[])
- [ ] Auto-execution of trades and watchlist changes from LLM response
- [ ] LLM mock mode (`LLM_MOCK=true`) for deterministic testing
- [ ] Next.js frontend: watchlist panel, main chart, heatmap, P&L chart, positions table, trade bar, chat panel, header
- [ ] Price flash animations (green/red CSS transitions, ~500ms)
- [ ] Sparkline mini-charts accumulated from SSE since page load
- [ ] Multi-stage Dockerfile (Node 20 → Python 3.12)
- [ ] Start/stop scripts (Mac shell + Windows PowerShell)
- [ ] E2E Playwright test suite (7 key scenarios)

### Out of Scope
- User authentication / multi-user (schema has user_id but hardcoded to "default")
- Limit orders, order book, partial fills — market orders only
- Cloud deployment / Terraform (stretch goal, not part of core build)
- Mobile-first design (desktop-first, tablet-functional)
- Real money, regulatory compliance

## Context

- Market data component complete: `backend/app/market/` (8 modules, ~500 lines)
- Full spec in `planning/PLAN.md` — single source of truth for all design decisions
- Capstone for course: demonstrates orchestrated AI agents building production full-stack app
- Students run one Docker command to get the full experience

## Constraints

- **Single Docker container, port 8000** — no docker-compose for production
- **Python uv project** (backend) — `uv run`, `uv add`, never `pip install`
- **Static Next.js export** (`output: 'export'`) served by FastAPI
- **SQLite** — no Postgres, self-contained, zero config
- **SSE not WebSockets** — one-way push, simpler, universal browser support
- **OpenRouter + Cerebras** for LLM via LiteLLM (`openrouter/openai/gpt-oss-120b`)
- **No emojis** in code or print statements

## Key Decisions

| Decision | Outcome | Notes |
|----------|---------|-------|
| SSE vs WebSockets | ✓ Good | One-way push sufficient; simpler reconnection |
| SQLite vs Postgres | ✓ Good | Single-user, no auth, zero config |
| Static Next.js export | ✓ Good | Same origin, no CORS, one port |
| uv for Python | ✓ Good | Fast, modern, reproducible lockfile |
| Market orders only | ✓ Good | Eliminates order book complexity |
| GBM simulator default | ✓ Good | No API key needed for students |
| Cerebras via OpenRouter | — Pending | Fast inference for chat UX |

---

*Evolution: After each phase — move completed reqs to Validated, log decisions. After each milestone — full review.*
