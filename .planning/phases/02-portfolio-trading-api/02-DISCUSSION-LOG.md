# Phase 2: Portfolio & Trading API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 2-portfolio-trading-api
**Areas discussed:** Router structure, Shared state access, Error response shapes, Snapshot task wiring

---

## All Areas

| Option | Description | Selected |
|--------|-------------|----------|
| Router structure: two files | `api/portfolio.py` + `api/watchlist.py` | ✓ |
| Router structure: one file | Combined `api/routes.py` | |
| Router structure: inline main.py | Add routes directly to main.py | |
| Shared state: `app/state.py` module | Module-level singletons extracted to dedicated module | ✓ |
| Shared state: `app.state` injection | FastAPI Request + Depends pattern | |
| Shared state: import from main.py | Direct import (circular import risk) | |
| Errors: `HTTPException(400, detail)` | Standard FastAPI error, `{"detail": "message"}` | ✓ |
| Errors: Pydantic 422 | Default FastAPI validation errors | |
| Errors: custom wrapper | Custom `{"error": "..."}` shape | |
| Snapshot: asyncio task in lifespan | `create_task(snapshot_loop())`, cancellable | ✓ |
| Snapshot: separate module | Dedicated background task module | |

**User's choice:** All decisions deferred to Claude — "scegli tu sulla base delle best practices che puoi trovare anche online. l'importante è che il codice sia snello e robusto, la piattaforma veloce. evita codice inutile" (choose based on best practices, lean and robust code, fast platform, no unnecessary code)

**Notes:** User explicitly asked Claude to make all implementation decisions using best practices. Priority: lean, robust, fast. No unnecessary abstractions.

---

## Claude's Discretion

All four gray areas: Router structure, Shared state access, Error response shapes, Snapshot task wiring — user delegated all decisions to Claude based on best practices.

## Deferred Ideas

None — discussion stayed within phase scope.
