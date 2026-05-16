# Phase 4: Frontend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 04-frontend
**Areas discussed:** Charting library, Panel layout, Chat panel style (all delegated to Claude)

---

## Gray Area Selection

| Area | Description | Selected for discussion |
|------|-------------|------------------------|
| Charting library | Lightweight Charts vs Recharts vs hybrid | All delegated |
| Panel layout | Column arrangement, trade bar placement | All delegated |
| Chat panel style | Always-visible vs collapsible | All delegated |

**User's choice:** "scegli tu sulla base delle best practices in modo da scrivere un codice pulito e sintetico"
(Translation: "you decide based on best practices so as to write clean and concise code")

---

## Charting library

| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight Charts only | Canvas, ultra-fast for price charts, no treemap | |
| Recharts only | SVG, React-native, handles all chart types including Treemap | ✓ |
| Hybrid (both) | Lightweight Charts for main chart, Recharts for treemap/P&L | |

**Claude's choice:** Recharts for everything — one dependency, one API, handles Treemap natively.
**Notes:** Sparklines handled separately with pure SVG polyline (zero-dependency, concise).

---

## Panel Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Three-column (Bloomberg-style) | Left watchlist, center charts, right chat | ✓ |
| Top-heavy | Full-width chart at top, panels below | |
| Two-column (no persistent chat) | Wider center area, chat collapsible | |

**Claude's choice:** Three-column — Left (260px watchlist+trade bar), Center (flex-1 main chart+table+P&L), Right (320px chat). Trade bar pinned to bottom of left column.
**Notes:** Classic Bloomberg layout. Trade bar in watchlist column = natural spatial flow.

---

## Chat Panel Style

| Option | Description | Selected |
|--------|-------------|----------|
| Always-visible sidebar | Fixed 320px right column, no toggle | ✓ |
| Collapsible drawer | Button to show/hide, more chart space | |
| Modal overlay | Chat as popup, full-width layout otherwise | |

**Claude's choice:** Always-visible — simpler state management, better demo experience.

---

## Claude's Discretion

All three areas were fully delegated by the user. Additional discretion items:
- Zustand for SSE price state (vs React Context) — chosen for performance at 500ms update intervals
- Font: system-ui / monospace stack
- Exact grid proportions within columns
- CSS animation timings

## Deferred Ideas

- Candlestick / OHLCV charts → v2 requirement
- Multiple chart timeframes → v2
- Resizable panels → scope creep
- Mobile-responsive layout → explicitly out of scope (desktop-first)
