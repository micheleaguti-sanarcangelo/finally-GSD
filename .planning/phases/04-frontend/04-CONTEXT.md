# Phase 4: Frontend - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete Next.js TypeScript trading terminal UI — a static export (`output: 'export'`) served by FastAPI. All 8 panels (header, watchlist, main chart, portfolio heatmap, P&L chart, positions table, trade bar, chat panel) fully functional, connected to the existing backend via SSE and REST.

This phase delivers the visible product: the Bloomberg-inspired dark terminal. No backend changes.

</domain>

<decisions>
## Implementation Decisions

### Charting Library
- **D-01:** Use **Recharts** for all charts (main price chart, P&L line chart, portfolio treemap). One dependency, consistent React API, handles all required chart types including `<Treemap>`. Install: `npm install recharts`.
- **D-02:** Sparklines use **pure SVG polyline** rendered inline from a price array — no charting library, zero overhead, ~10 lines of code per sparkline component.

### Panel Layout
- **D-03:** Three-column fixed layout below a full-width header:
  - **Left column** (~260px): Watchlist table + Trade bar pinned to bottom of this column
  - **Center column** (flex-1): Main chart (top ~55%), Positions table + P&L chart (bottom ~45%)
  - **Right column** (~320px): Chat panel (full height of content area)
- **D-04:** Header is full-width, fixed at top — shows live total portfolio value, cash balance, connection status dot.
- **D-05:** Trade bar sits at the bottom of the left column (not a separate row). Natural flow: see watchlist price → enter trade in same column.

### Chat Panel
- **D-06:** Chat panel is **always-visible** right sidebar (no collapse toggle). Simplest state, best demo experience — the AI assistant is always present. Fixed 320px width.

### State Management
- **D-07:** Use **Zustand** for the global SSE price store. Prices update every ~500ms across 10 tickers — Zustand's fine-grained subscription prevents unnecessary re-renders across the whole component tree. Install: `npm install zustand`.
- **D-08:** Portfolio data (positions, cash, history) and watchlist are fetched via standard `fetch` + local React state (or `useState`/`useEffect`). They update on trade execution, not continuously — no global store needed for these.

### SSE Connection
- **D-09:** Single `EventSource` instance at the app root (or a top-level hook `useSSE`). On each price event: update the Zustand price store. Connection status dot derives from EventSource `readyState` — green (1=OPEN), yellow (0=CONNECTING), red (2=CLOSED). Auto-reconnect is built into `EventSource`.

### Price Flash Animations
- **D-10:** On each price update, apply a CSS class (`flash-up` or `flash-down`) to the price cell for 500ms via `setTimeout`. Classes use a Tailwind keyframe animation (brief background flash green/red that fades). Remove the class after 500ms to allow re-triggering on next update.

### API Integration
- **D-11:** All API calls use relative paths (`/api/*`) — same origin, no CORS config needed. Use native `fetch`; no axios or SWR needed.
- **D-12:** After any trade execution (`POST /api/portfolio/trade` or via chat response), immediately re-fetch `/api/portfolio` and `/api/portfolio/history` to refresh positions, cash, and P&L chart.

### Styling
- **D-13:** Tailwind CSS with custom theme extension in `tailwind.config.ts`:
  - `colors.bg-primary: '#0d1117'`, `colors.bg-secondary: '#1a1a2e'`
  - `colors.accent-yellow: '#ecad0a'`, `colors.accent-blue: '#209dd7'`, `colors.accent-purple: '#753991'`
- **D-14:** No UI component library (no shadcn, no MUI) — custom components only. Keep it lean.

### Claude's Discretion
- Exact CSS grid proportions within the three-column layout
- Font choice (system-ui or monospace stack — terminal feel)
- Table cell padding, border radii, transition durations
- Loading skeleton vs. spinner for async data

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Spec & Requirements
- `planning/PLAN.md` §10 (Frontend Design) — layout panels, visual design spec, SSE notes, animation spec
- `planning/PLAN.md` §2 (User Experience) — color scheme, visual design philosophy
- `.planning/REQUIREMENTS.md` UI-01 through UI-10 — all 10 frontend requirements

### Backend API Contract (read before building any data-fetching hook)
- `backend/app/api/portfolio.py` — response shapes for GET /api/portfolio, POST /api/portfolio/trade, GET /api/portfolio/history
- `backend/app/api/watchlist.py` — response shapes for GET/POST/DELETE /api/watchlist
- `backend/app/api/chat.py` — request/response schema for POST /api/chat (message, trades[], watchlist_changes[])
- `backend/app/market/` — SSE event format (ticker, price, previous_price, timestamp, direction)

### Project Constraints
- `.planning/PROJECT.md` — constraints section (single container, static export, no emojis, desktop-first)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing frontend components — greenfield Next.js project

### Established Patterns (backend — informs frontend data shapes)
- SSE events emitted from `backend/app/market/` at ~500ms intervals; format: `{ticker, price, previous_price, timestamp, direction}`
- All API routes are async FastAPI endpoints at `/api/*`
- Chat response schema: `{message: str, trades: [{ticker, side, quantity}], watchlist_changes: [{ticker, action}]}`

### Integration Points
- `GET /api/stream/prices` — SSE stream, connect with `new EventSource('/api/stream/prices')`
- `GET /api/portfolio` — call on mount and after each trade
- `GET /api/portfolio/history` — call on mount and after each trade (for P&L chart)
- `GET /api/watchlist` — call on mount and after watchlist mutations
- `POST /api/watchlist` / `DELETE /api/watchlist/{ticker}` — watchlist CRUD
- `POST /api/portfolio/trade` — trade execution
- `POST /api/chat` — AI chat, response includes executed actions

</code_context>

<specifics>
## Specific Ideas

- Bloomberg/trading terminal aesthetic — data-dense, every pixel earns its place
- Prices flash brief green/red background highlight on change, fading ~500ms (CSS transition)
- Sparklines fill in progressively from SSE data accumulated since page load (not historical data)
- Connection status dot: small colored circle in header (green=connected, yellow=reconnecting, red=disconnected)
- Chat shows inline confirmation when a trade is executed by AI (e.g. "Executed buy 5 AAPL @ $190.00")
- Trade bar: no confirmation dialog — instant fill is the design intent

</specifics>

<deferred>
## Deferred Ideas

- Candlestick / OHLCV charts (v2 requirement — requires different data from backend)
- Multiple chart timeframes (v2)
- Portfolio vs benchmark chart (v2)
- Trade history view with filtering (v2)
- Resizable panels (scope creep for this phase)
- Mobile-responsive layout (out of scope — desktop-first)

</deferred>

---

*Phase: 4-Frontend*
*Context gathered: 2026-05-16*
