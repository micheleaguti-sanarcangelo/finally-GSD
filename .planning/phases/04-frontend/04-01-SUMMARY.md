---
phase: 04-frontend
plan: 01
subsystem: ui
tags: [nextjs, tailwind, zustand, typescript, sse, react]

# Dependency graph
requires:
  - phase: 03-llm-chat
    provides: Backend API fully implemented including /api/stream/prices SSE endpoint

provides:
  - Next.js 14 static export project scaffold
  - Tailwind v3 dark terminal theme with custom color tokens
  - Zustand price store (usePriceStore) tracking live prices and connection status
  - useSSE hook connecting EventSource to /api/stream/prices
  - Flash animation keyframes (flash-up, flash-down) in globals.css

affects: [04-02-watchlist, 04-03-trade-chat, 04-04-charts, 04-05-assembly]

# Tech tracking
tech-stack:
  added: [next@14.2.29, react@18, recharts@2.12, zustand@4.5, tailwindcss@3.4, typescript@5]
  patterns: [zustand-price-store, sse-eventSource-hook, nextjs-app-router-static-export]

key-files:
  created:
    - frontend/package.json
    - frontend/next.config.mjs
    - frontend/tailwind.config.ts
    - frontend/postcss.config.mjs
    - frontend/tsconfig.json
    - frontend/src/app/globals.css
    - frontend/src/app/layout.tsx
    - frontend/src/app/page.tsx
    - frontend/src/lib/store.ts
    - frontend/src/hooks/useSSE.ts
  modified:
    - .gitignore

key-decisions:
  - "Use next.config.mjs (not next.config.ts) — Next.js 14 does not support .ts config files"
  - "Scope lib/ in .gitignore to root-only (/lib/) to avoid blocking frontend/src/lib/"
  - "Zustand store uses getState() inside SSE event handlers (not hook) to avoid stale closure re-render issues"
  - "EventSource onerror does not call source.close() — native auto-retry is intentional"

patterns-established:
  - "usePriceStore pattern: all price reads go through Zustand; SSE events call getState().setPrices()"
  - "useSSE called once at app root — single EventSource instance for entire app lifetime"
  - "CSS keyframe animations declared in globals.css and applied via class toggle (flash-up/flash-down)"

requirements-completed: [UI-09, UI-10]

# Metrics
duration: 20min
completed: 2026-05-16
---

# Phase 4 Plan 01: Frontend Scaffold Summary

**Next.js 14 TypeScript static export with Tailwind dark terminal theme, Zustand price store, and SSE EventSource hook wiring live prices to the component tree**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-16T00:00:00Z
- **Completed:** 2026-05-16T00:20:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Manually scaffolded Next.js 14 app router project (interactive create-next-app not available in CI environment)
- Configured Tailwind v3 with 5 custom color tokens (bg-primary, bg-secondary, accent-yellow/blue/purple) and CSS flash animations
- Built Zustand price store with merged updates (not replace) and connection status tracking
- Built useSSE hook with try/catch error handling per threat model mitigation T-04-01

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js project with Tailwind and install dependencies** - `cc2430d` (feat)
2. **Task 2: Zustand price store and useSSE hook** - `6989435` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/package.json` - Next.js 14 project with recharts, zustand, tailwindcss declared
- `frontend/next.config.mjs` - Static export configuration (`output: 'export'`)
- `frontend/tailwind.config.ts` - Custom color tokens including accent-yellow `#ecad0a`
- `frontend/postcss.config.mjs` - PostCSS with tailwindcss and autoprefixer
- `frontend/tsconfig.json` - TypeScript config with @/* path alias
- `frontend/src/app/globals.css` - Dark theme body, flash-up/flash-down keyframes
- `frontend/src/app/layout.tsx` - Root layout with dark background, "FinAlly" metadata
- `frontend/src/app/page.tsx` - Placeholder page (replaced in Plan 05)
- `frontend/src/lib/store.ts` - usePriceStore Zustand store (prices, status, setPrices, setStatus)
- `frontend/src/hooks/useSSE.ts` - Single EventSource hook wired to /api/stream/prices
- `.gitignore` - Added frontend build artifact exclusions; scoped lib/ to root-only

## Decisions Made

- Used `next.config.mjs` not `next.config.ts` — Next.js 14.2 does not support TypeScript config files
- Scoped `lib/` pattern in root .gitignore to `/lib/` to prevent it matching `frontend/src/lib/`
- `useSSE` uses `usePriceStore.getState()` inside event handlers (not the React hook) to avoid re-render issues inside closures
- `onerror` handler does not call `source.close()` — EventSource auto-reconnect is intentional behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used next.config.mjs instead of next.config.ts**
- **Found during:** Task 1 (initial build)
- **Issue:** Next.js 14.2 does not support `next.config.ts` — build error: "Configuring Next.js via 'next.config.ts' is not supported"
- **Fix:** Created `next.config.mjs` with equivalent ESM module export syntax
- **Files modified:** frontend/next.config.mjs (created), frontend/next.config.ts (removed)
- **Verification:** `npm run build` exits 0
- **Committed in:** cc2430d

**2. [Rule 1 - Bug] Fixed .gitignore lib/ pattern blocking frontend/src/lib/**
- **Found during:** Task 2 (committing store.ts)
- **Issue:** Root `.gitignore` had bare `lib/` pattern matching any lib/ directory recursively, blocking `git add frontend/src/lib/store.ts`
- **Fix:** Changed `lib/` to `/lib/` (root-anchored) in .gitignore
- **Files modified:** .gitignore
- **Verification:** `git add frontend/src/lib/store.ts` succeeds without -f flag
- **Committed in:** 6989435

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes required for correct operation. No scope creep.

## Issues Encountered

- Next.js 14 does not support `next.config.ts` — resolved by using `next.config.mjs`
- Root `.gitignore` Python boilerplate `lib/` pattern conflicts with frontend source structure — resolved by anchoring pattern

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Foundation complete: Next.js builds to `frontend/out/` with static export
- Color tokens available as Tailwind classes for all subsequent components
- `usePriceStore` ready for Watchlist and Header components (Plan 02)
- `useSSE` ready to be called from app root (Plan 05 layout assembly)
- All TypeScript types for PriceUpdate interface exported from store.ts

---
*Phase: 04-frontend*
*Completed: 2026-05-16*
