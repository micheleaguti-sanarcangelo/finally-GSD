# Requirements: FinAlly — AI Trading Workstation

**Defined:** 2026-05-15
**Core Value:** A single Docker command launches a fully functional trading terminal with live prices, portfolio tracking, and an AI copilot that executes trades on command.

---

## v1 Requirements

### DB — Database & Initialization
- [ ] DB-01: SQLite lazy initialization — create all tables and seed default data on first start if DB file missing or empty
- [ ] DB-02: `users_profile` table — id="default", cash_balance=10000.0
- [ ] DB-03: `watchlist` table — 10 default tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX)
- [ ] DB-04: `positions` table — one row per (user_id, ticker), with quantity, avg_cost, updated_at
- [ ] DB-05: `trades` table — append-only log with side (buy/sell), quantity, price, executed_at
- [ ] DB-06: `portfolio_snapshots` table — recorded every 30s by background task and immediately after each trade
- [ ] DB-07: `chat_messages` table — role (user/assistant), content, actions JSON (trades/watchlist changes)

### API — Backend REST Endpoints
- [ ] API-01: `GET /api/portfolio` — returns positions, cash balance, total value, unrealized P&L per position
- [ ] API-02: `POST /api/portfolio/trade` — execute market order `{ticker, quantity, side}`; instant fill at current price
- [ ] API-03: `GET /api/portfolio/history` — portfolio value snapshots over time for P&L chart
- [ ] API-04: `GET /api/watchlist` — current watchlist tickers with latest prices from cache
- [ ] API-05: `POST /api/watchlist` — add ticker `{ticker}`; also registers ticker with market data source
- [ ] API-06: `DELETE /api/watchlist/{ticker}` — remove ticker
- [ ] API-07: `POST /api/chat` — send message, receive structured JSON response (message + executed actions)
- [ ] API-08: `GET /api/health` — health check returning 200 OK

### TRADE — Trading Logic
- [ ] TRADE-01: Market order fills instantly at current price from `PriceCache`
- [ ] TRADE-02: Buy validation — reject if cash_balance < quantity × price
- [ ] TRADE-03: Sell validation — reject if position quantity < requested sell quantity
- [ ] TRADE-04: `avg_cost` recalculated correctly on each buy (weighted average); position removed when quantity reaches 0
- [ ] TRADE-05: Portfolio snapshot recorded immediately after each trade execution

### LLM — Chat Integration
- [ ] LLM-01: Structured output schema: `{message: str, trades: [{ticker, side, quantity}], watchlist_changes: [{ticker, action}]}`
- [ ] LLM-02: System prompt includes current portfolio context (cash, positions with P&L, watchlist with live prices, total value)
- [ ] LLM-03: Auto-execute all trades from LLM response through same validation as manual trades
- [ ] LLM-04: Auto-apply all watchlist changes from LLM response
- [ ] LLM-05: `LLM_MOCK=true` env var returns deterministic mock response (no OpenRouter call)
- [ ] LLM-06: Recent conversation history loaded from `chat_messages` table and included in prompt

### UI — Frontend
- [ ] UI-01: Watchlist panel — ticker symbol, current price, daily change %, sparkline (accumulated from SSE since page load); price flashes green/red on uptick/downtick (~500ms CSS transition)
- [ ] UI-02: Main chart area — larger price-over-time chart for selected ticker; clicking watchlist row selects it
- [ ] UI-03: Portfolio heatmap (treemap) — positions sized by portfolio weight, colored by P&L (green profit, red loss)
- [ ] UI-04: P&L chart — line chart of total portfolio value over time from `/api/portfolio/history`
- [ ] UI-05: Positions table — ticker, quantity, avg cost, current price, unrealized P&L, % change
- [ ] UI-06: Trade bar — ticker field, quantity field, buy button, sell button; market orders, instant fill
- [ ] UI-07: AI chat panel — message input, scrolling conversation history, loading indicator; inline trade/watchlist confirmations
- [ ] UI-08: Header — live total portfolio value, cash balance, connection status dot (green/yellow/red)
- [ ] UI-09: SSE `EventSource` connection to `/api/stream/prices` with automatic reconnection
- [ ] UI-10: Dark terminal theme — bg `#0d1117`/`#1a1a2e`, accent yellow `#ecad0a`, blue `#209dd7`, purple `#753991` (submit buttons)

### INFRA — Docker & Deployment
- [ ] INFRA-01: Multi-stage Dockerfile — Stage 1: Node 20 slim (Next.js build), Stage 2: Python 3.12 slim (uv + FastAPI)
- [ ] INFRA-02: FastAPI serves static Next.js export at `/*` and all API routes at `/api/*` on port 8000
- [ ] INFRA-03: SQLite volume mount — DB written to `/app/db/finally.db` in container, maps to `db/` in project root
- [ ] INFRA-04: `scripts/start_mac.sh` and `scripts/stop_mac.sh` (idempotent, builds if needed, prints URL)
- [ ] INFRA-05: `scripts/start_windows.ps1` and `scripts/stop_windows.ps1` (PowerShell equivalents)
- [ ] INFRA-06: `.env.example` committed with placeholder values; `.env` gitignored

### TEST — E2E Tests
- [ ] TEST-01: Fresh start — default watchlist appears, $10k balance shown, prices streaming
- [ ] TEST-02: Add and remove a ticker from the watchlist
- [ ] TEST-03: Buy shares — cash decreases, position appears, portfolio updates
- [ ] TEST-04: Sell shares — cash increases, position updates or disappears
- [ ] TEST-05: Portfolio visualization — heatmap renders with correct colors, P&L chart has data points
- [ ] TEST-06: AI chat (mocked) — send message, receive response, trade execution appears inline
- [ ] TEST-07: SSE resilience — disconnect and verify reconnection

---

## v2 Requirements

- Real-time candlestick charts (OHLCV data, not just price history)
- Multiple chart timeframes (1m, 5m, 1h, 1d)
- Portfolio performance vs benchmark (S&P 500)
- Trade history view with filtering
- Cloud deployment (AWS App Runner or Render via Terraform)

---

## Out of Scope

- **User auth / accounts** — single default user, hardcoded in schema
- **Limit/stop orders** — market orders only, eliminates order book complexity
- **Fractional shares UI** — backend supports it, but UI shows whole shares only
- **Real money / brokerage integration** — simulated portfolio only
- **Mobile-first design** — desktop-first, functional on tablet
- **Multi-container docker-compose for production** — single container only

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DB-01 | Phase 1 | Pending |
| DB-02 | Phase 1 | Pending |
| DB-03 | Phase 1 | Pending |
| DB-04 | Phase 1 | Pending |
| DB-05 | Phase 1 | Pending |
| DB-06 | Phase 1 | Pending |
| DB-07 | Phase 1 | Pending |
| API-08 | Phase 1 | Pending |
| API-01 | Phase 2 | Pending |
| API-02 | Phase 2 | Pending |
| API-03 | Phase 2 | Pending |
| API-04 | Phase 2 | Pending |
| API-05 | Phase 2 | Pending |
| API-06 | Phase 2 | Pending |
| TRADE-01 | Phase 2 | Pending |
| TRADE-02 | Phase 2 | Pending |
| TRADE-03 | Phase 2 | Pending |
| TRADE-04 | Phase 2 | Pending |
| TRADE-05 | Phase 2 | Pending |
| API-07 | Phase 3 | Pending |
| LLM-01 | Phase 3 | Pending |
| LLM-02 | Phase 3 | Pending |
| LLM-03 | Phase 3 | Pending |
| LLM-04 | Phase 3 | Pending |
| LLM-05 | Phase 3 | Pending |
| LLM-06 | Phase 3 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 4 | Pending |
| UI-06 | Phase 4 | Pending |
| UI-07 | Phase 4 | Pending |
| UI-08 | Phase 4 | Pending |
| UI-09 | Phase 4 | Pending |
| UI-10 | Phase 4 | Pending |
| INFRA-01 | Phase 5 | Pending |
| INFRA-02 | Phase 5 | Pending |
| INFRA-03 | Phase 5 | Pending |
| INFRA-04 | Phase 5 | Pending |
| INFRA-05 | Phase 5 | Pending |
| INFRA-06 | Phase 5 | Pending |
| TEST-01 | Phase 6 | Pending |
| TEST-02 | Phase 6 | Pending |
| TEST-03 | Phase 6 | Pending |
| TEST-04 | Phase 6 | Pending |
| TEST-05 | Phase 6 | Pending |
| TEST-06 | Phase 6 | Pending |
| TEST-07 | Phase 6 | Pending |
