---
phase: 04-frontend
plan: 02
subsystem: ui
tags: [nextjs, react, typescript, zustand, sse, sparkline, svg, flash-animation]

# Dependency graph
requires:
  - plan: 04-01
    provides: Zustand price store (usePriceStore), flash-up/flash-down keyframes in globals.css, useSSE hook

provides:
  - Header component with live portfolio value, cash balance, and SSE connection status dot
  - Sparkline component — pure SVG polyline from price number array
  - WatchlistPanel — watchlist table with live prices, price flash animations, sparklines, add/remove ticker

affects: [04-05-assembly]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - zustand-selector-subscription (usePriceStore per-field selector to avoid whole-store re-renders)
    - css-class-toggle-flash (setTimeout 500ms flash-up/flash-down via React state + useRef timer cleanup)
    - svg-sparkline-minmax (pure SVG polyline with min/max normalization, no library)
    - relative-fetch-api (fetch('/api/watchlist') same-origin, no CORS needed)

key-files:
  created:
    - frontend/src/components/Header.tsx
    - frontend/src/components/Sparkline.tsx
    - frontend/src/components/WatchlistPanel.tsx

key-decisions:
  - "WatchlistPanel useEffect splits into two separate effects: one for sparkline history accumulation, one for unmount cleanup — avoids stale closure over flashTimers ref"
  - "Sparkline is a plain function component (no 'use client') — pure computation from props, no browser APIs needed"
  - "Flash timers stored in useRef (not state) to avoid re-renders when clearing timeouts"
  - "Ticker input sanitized with toUpperCase().trim() before POST per threat model T-04-03; maxLength=10 attribute added"

# Metrics
duration: 15min
completed: 2026-05-16
---

# Phase 4 Plan 02: Header, Sparkline, and WatchlistPanel Summary

**Header bar with live portfolio metrics and SSE status dot; Sparkline pure SVG polyline; WatchlistPanel with live price flash animations, sparkline accumulation, and watchlist CRUD**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-16T07:54:32Z
- **Completed:** 2026-05-16T08:10:00Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- Created Header.tsx: reads SSE status from Zustand store, displays colored dot (green/yellow/red), shows portfolio value and cash formatted with toLocaleString
- Created Sparkline.tsx: pure SVG polyline with min/max normalization, no charting library, ~35 lines
- Created WatchlistPanel.tsx: fetches watchlist on mount, subscribes to Zustand prices, accumulates up to 60-point sparkline history per ticker, applies flash-up/flash-down class for 500ms per direction change, supports add/remove ticker via REST
- TypeScript strict mode: zero errors across all three files

## Task Commits

1. **Task 1: Header component** — `7ee32e1` (feat)
2. **Task 2: Sparkline and WatchlistPanel** — `49262d8` (feat)

## Files Created

- `frontend/src/components/Header.tsx` — 'use client', usePriceStore(status), portfolio value/cash props, connection dot
- `frontend/src/components/Sparkline.tsx` — pure SVG polyline, width/height props with defaults (80x32)
- `frontend/src/components/WatchlistPanel.tsx` — 'use client', watchlist CRUD, price flash, sparkline history, row selection

## Decisions Made

- Sparkline has no 'use client' — it's a pure function component with no browser APIs
- Flash timers kept in useRef to avoid triggering re-renders on clear; unmount effect clears all timers
- Ticker input uppercased and trimmed per threat model T-04-03; maxLength=10 attribute enforced in HTML

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components are fully wired. WatchlistPanel fetches live data from /api/watchlist. Sparkline receives live data from SSE via Zustand. Header receives totalValue/cashBalance as props (to be provided by page.tsx in Plan 05).

## Threat Flags

None — no new network endpoints or auth paths introduced. Browser-to-API calls are same-origin relative URLs.

## Self-Check: PASSED

- `frontend/src/components/Header.tsx` — EXISTS
- `frontend/src/components/Sparkline.tsx` — EXISTS
- `frontend/src/components/WatchlistPanel.tsx` — EXISTS
- Commit `7ee32e1` — EXISTS (feat(04-02): Header component)
- Commit `49262d8` — EXISTS (feat(04-02): Sparkline SVG component and WatchlistPanel)
- `npx tsc --noEmit` — PASSED (0 errors)
- All acceptance criteria verified via grep
