---
phase: 04-frontend
plan: 03
subsystem: ui
tags: [nextjs, react, typescript, zustand, fetch, trade, chat, positions]

# Dependency graph
requires:
  - plan: 04-01
    provides: Zustand price store (usePriceStore), flash keyframes
  - plan: 04-02
    provides: WatchlistPanel pattern (dark table styling, relative fetch API)

provides:
  - TradeBar component — market order execution with ticker/quantity inputs and buy/sell buttons
  - PositionsTable component — live P&L from Zustand prices, recomputed inline
  - ChatPanel component — AI chat with loading state, inline trade/watchlist confirmations

affects: [04-05-assembly]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - zustand-selector-subscription (usePriceStore for live prices in PositionsTable)
    - useEffect-prop-sync (selectedTicker -> ticker state in TradeBar)
    - controlled-loading-gate (loading=true disables inputs and buttons; prevents concurrent requests)
    - keyboard-submit-onKeyDown (Enter without Shift submits; Shift+Enter newline in ChatPanel)
    - auto-scroll-ref (messagesEndRef.scrollTop = scrollHeight after message append)
    - inline-action-pills (trade/watchlist confirmation badges rendered after assistant message)

key-files:
  created:
    - frontend/src/components/TradeBar.tsx
    - frontend/src/components/PositionsTable.tsx
    - frontend/src/components/ChatPanel.tsx

key-decisions:
  - "TradeBar does NOT clear ticker/quantity fields after successful trade — user likely wants to trade same ticker again"
  - "PositionsTable ignores unrealized_pnl prop — recomputes live from prices[ticker].price to avoid staleness"
  - "ChatPanel uses messagesEndRef on the scroll container div (not a sentinel element) — scrollTop = scrollHeight approach"
  - "ChatPanel generic error message on fetch failure (T-04-07: do not expose fetch error detail to UI)"

requirements-completed: [UI-05, UI-06, UI-07]

# Metrics
duration: 15min
completed: 2026-05-16
---

# Phase 4 Plan 03: TradeBar, PositionsTable, and ChatPanel Summary

**TradeBar with market order validation; PositionsTable with live Zustand prices and recomputed P&L; ChatPanel with AI conversation history, loading state, and inline trade/watchlist confirmation pills**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-16T08:10:00Z
- **Completed:** 2026-05-16T08:25:00Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- Created TradeBar.tsx: syncs selectedTicker prop via useEffect, parses quantity with parseInt radix-10, sends market order POST, handles 400 errors with detail from backend, green buy / red sell buttons
- Created PositionsTable.tsx: reads from Zustand prices store for live current price column, recomputes P&L and P&L% inline from live price (not stale prop), empty state message
- Created ChatPanel.tsx: full conversation history rendering (user right / assistant left), loading/thinking indicator, inline trade confirmation pills (green buy / red sell), watchlist change pills (blue), Enter-to-submit keyboard handling, auto-scroll, onTradeExecuted callback after AI trade execution
- TypeScript strict mode: zero errors across all three files

## Task Commits

1. **Task 1: TradeBar component** — `d6dd4d7` (feat)
2. **Task 2: PositionsTable and ChatPanel** — `498f544` (feat)

## Files Created

- `frontend/src/components/TradeBar.tsx` — 'use client', useEffect prop sync, parseInt validation, fetch POST /api/portfolio/trade, green/red buttons
- `frontend/src/components/PositionsTable.tsx` — 'use client', usePriceStore live price, inline P&L recomputation, dark table styling
- `frontend/src/components/ChatPanel.tsx` — 'use client', fetch POST /api/chat, conversation history, loading gate, trade/watchlist pills, keyboard submit, auto-scroll

## Decisions Made

- TradeBar keeps ticker/quantity fields populated after successful trade (user trades same ticker repeatedly)
- PositionsTable recomputes unrealized P&L from live Zustand price, ignoring stale `unrealized_pnl` prop
- ChatPanel auto-scrolls by setting `scrollTop = scrollHeight` on the container div ref
- ChatPanel shows generic "Error: could not reach the assistant" on fetch failure — per threat model T-04-07 (no detail exposure)

## Deviations from Plan

None — plan executed exactly as written. All threat model mitigations applied:
- T-04-05: `ticker.toUpperCase().trim()` before POST
- T-04-06: `parseInt(quantity, 10)` with NaN/<=0 guard
- T-04-07: Generic error message only, no fetch error details shown
- T-04-08: `loading=true` disables send button and textarea

## Known Stubs

None — all components are fully wired with real API calls and real Zustand data. No hardcoded mock data or placeholder text in data paths.

## Threat Flags

None — no new network endpoints or auth paths introduced. All browser-to-API calls use relative same-origin URLs.

## Self-Check: PASSED

- `frontend/src/components/TradeBar.tsx` — EXISTS
- `frontend/src/components/PositionsTable.tsx` — EXISTS
- `frontend/src/components/ChatPanel.tsx` — EXISTS
- Commit `d6dd4d7` — EXISTS (feat(04-03): TradeBar component)
- Commit `498f544` — EXISTS (feat(04-03): PositionsTable and ChatPanel)
- `npx tsc --noEmit` — PASSED (exit code 0)
- `grep "api/portfolio/trade" TradeBar.tsx` — MATCHES
- `grep "usePriceStore" PositionsTable.tsx` — MATCHES
- `grep "api/chat" ChatPanel.tsx` — MATCHES
- `grep "Executed" ChatPanel.tsx` — MATCHES
- `grep "753991" ChatPanel.tsx` — MATCHES
