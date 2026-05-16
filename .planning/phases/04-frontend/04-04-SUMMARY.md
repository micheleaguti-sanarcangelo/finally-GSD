---
phase: 04-frontend
plan: 04
subsystem: ui
tags: [recharts, zustand, sse, typescript, treemap, areachart]

# Dependency graph
requires:
  - phase: 04-frontend
    plan: 01
    provides: Zustand usePriceStore and Next.js scaffold
  - phase: 04-frontend
    plan: 02
    provides: WatchlistPanel, Header components
  - phase: 04-frontend
    plan: 03
    provides: TradeBar, ChatPanel, PositionsTable components

provides:
  - MainChart: live SSE-accumulated price history AreaChart for selected ticker
  - PortfolioHeatmap: Recharts Treemap colored by P&L, sized by market value
  - PnLChart: portfolio value history AreaChart fetched from /api/portfolio/history

affects: [04-05-assembly]

# Tech tracking
tech-stack:
  added: []
  patterns: [recharts-areachart-with-gradient, recharts-treemap-custom-content, zustand-price-accumulation]

key-files:
  created:
    - frontend/src/components/MainChart.tsx
    - frontend/src/components/PortfolioHeatmap.tsx
    - frontend/src/components/PnLChart.tsx
  modified: []

key-decisions:
  - "Used native SVG defs/linearGradient/stop inside JSX (not imported from recharts) for gradient fills"
  - "priceHistory accumulated in useState via useEffect on prices; useRef tracks last seen timestamp per ticker to avoid duplicate appends"
  - "Treemap data passed as flat array to recharts 2.x Treemap (not nested with children wrapper)"
  - "CustomContent uses any type for recharts Treemap content prop — no proper TS type available in recharts 2.x"

# Metrics
duration: 15min
completed: 2026-05-16
---

# Phase 4 Plan 04: Charts Summary

**Three Recharts chart components: MainChart (SSE price history AreaChart), PortfolioHeatmap (P&L-colored Treemap), PnLChart (portfolio value history AreaChart with accent-yellow gradient)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-16T00:00:00Z
- **Completed:** 2026-05-16T00:15:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- MainChart accumulates SSE price updates per ticker from Zustand, capped at 200 points, renders live-updating AreaChart with blue gradient fill (#209dd7)
- PortfolioHeatmap renders Recharts Treemap with custom SVG cell renderer: positions sized by live market value, green (#16a34a) for profit, red (#dc2626) for loss, gray for flat
- PnLChart fetches /api/portfolio/history on mount and re-fetches whenever historyVersion increments, renders AreaChart with accent-yellow gradient (#ecad0a)
- All three components pass `npx tsc --noEmit` with zero errors

## Task Commits

1. **Task 1: MainChart — live price history AreaChart** - `d10f11b` (feat)
2. **Task 2: PortfolioHeatmap Treemap and PnLChart AreaChart** - `7b5e36d` (feat)

## Files Created/Modified

- `frontend/src/components/MainChart.tsx` - Recharts AreaChart of SSE-accumulated per-ticker price history; blue gradient; isAnimationActive=false
- `frontend/src/components/PortfolioHeatmap.tsx` - Recharts Treemap with custom SVG content renderer; live-price market value sizing; P&L color coding
- `frontend/src/components/PnLChart.tsx` - Recharts AreaChart fetching portfolio snapshots; re-fetches on historyVersion prop change; accent-yellow gradient

## Decisions Made

- Used native JSX `<defs>/<linearGradient>/<stop>` for chart gradient definitions — these are SVG elements, not recharts exports
- Price history accumulation uses useRef to track last-seen timestamp per ticker, preventing duplicate points when useEffect fires without new data
- Treemap content prop receives a React element `<CustomContent />` — recharts 2.x calls it with cell props injected
- Flat data array passed directly to Treemap (not nested in a root node with children) — recharts 2.x handles flat arrays natively

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed incorrect recharts SVG exports from import**
- **Found during:** Task 1 (immediately after writing MainChart.tsx)
- **Issue:** `defs`, `linearGradient`, `stop` are SVG elements used inline in JSX, not recharts exports. Importing them from recharts would cause a TypeScript/runtime error.
- **Fix:** Removed them from the recharts import; used native JSX SVG elements `<defs>`, `<linearGradient>`, `<stop>` directly in JSX (they render as SVG)
- **Files modified:** frontend/src/components/MainChart.tsx
- **Verification:** `npx tsc --noEmit` exits 0

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minor import correction. No scope change.

## Known Stubs

None — all three components connect to live data sources (Zustand SSE store and /api/portfolio/history). No hardcoded placeholder values.

## Threat Flags

None — only read-only data fetching and in-memory SSE price accumulation. No new network endpoints or auth paths introduced.

## Self-Check: PASSED

- `frontend/src/components/MainChart.tsx` — FOUND
- `frontend/src/components/PortfolioHeatmap.tsx` — FOUND
- `frontend/src/components/PnLChart.tsx` — FOUND
- Commit `d10f11b` — FOUND (MainChart)
- Commit `7b5e36d` — FOUND (PortfolioHeatmap + PnLChart)
- `npx tsc --noEmit` — exits 0 (verified)
- All acceptance criteria met: recharts imports, usePriceStore, isAnimationActive=false, color codes verified
