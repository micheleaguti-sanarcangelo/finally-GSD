---
phase: 05-docker-deployment
plan: "01"
subsystem: infrastructure
tags: [docker, fastapi, static-files, next-js]
dependency_graph:
  requires: [04-05]
  provides: [dockerfile, static-serving]
  affects: [05-02, 05-03]
tech_stack:
  added: [multi-stage-docker, fastapi-staticfiles]
  patterns: [multi-stage-build, static-export-serving]
key_files:
  created:
    - Dockerfile
  modified:
    - backend/app/main.py
decisions:
  - "uv sync --no-dev excludes pytest/ruff/httpx from production image"
  - "FileResponse import omitted — StaticFiles html=True handles SPA routing without catch-all"
  - "STATIC_DIR guard (exists()) lets dev mode work without /app/static present locally"
metrics:
  duration_minutes: 25
  completed_date: "2026-05-16"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 5 Plan 01: Dockerfile and Static Serving Summary

Multi-stage Dockerfile builds the full FinAlly stack into a single 199MB image; FastAPI serves the Next.js static export at `/` with all `/api/*` routes remaining functional.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write multi-stage Dockerfile | 856fabd | Dockerfile |
| 2 | Add StaticFiles mount to FastAPI | 1368a1d | backend/app/main.py |

## What Was Built

### Task 1: Dockerfile

Two-stage build:
- **Stage 1** (`node:20-slim`): copies `frontend/`, runs `npm ci` + `npm run build`, produces `/build/frontend/out/`
- **Stage 2** (`python:3.12-slim`): installs uv via pip, copies `backend/`, runs `uv sync --no-dev`, copies static export to `/app/static`, creates `/app/db` volume mount point
- CMD: `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Image size: 199MB compressed

### Task 2: FastAPI StaticFiles Mount

Added to `backend/app/main.py`:
- `from fastapi.staticfiles import StaticFiles`
- `STATIC_DIR = Path("/app/static")`
- Mount at `/` with `html=True` after all API routers and health route
- Guarded by `STATIC_DIR.exists()` so local dev without `/app/static` continues to work
- `html=True` serves `index.html` for directory requests and handles SPA 404 fallback

## Verification Results

All five plan must-haves verified:

| Check | Result |
|-------|--------|
| `docker build -t finally .` exits 0 | PASS — image built successfully |
| Container starts, FastAPI serves on port 8000 | PASS — uvicorn starts, market simulator connects |
| `GET /` returns Next.js HTML | PASS — `<!DOCTYPE html>` returned, HTTP 200 |
| `GET /api/health` returns `{"status": "ok"}` | PASS |
| `uv run python -c "from app.main import app"` prints "import ok" | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Removed unused FileResponse import**
- **Found during:** Task 2
- **Issue:** Plan suggested importing `FileResponse` but `html=True` on `StaticFiles` already handles SPA routing — no explicit catch-all needed
- **Fix:** Omitted `FileResponse` import to keep the code clean and avoid lint warnings
- **Files modified:** `backend/app/main.py`

No other deviations — plan executed as written.

## Known Stubs

None. The Dockerfile and FastAPI static serving are fully wired.

## Threat Flags

None. All threat model items addressed:
- T-05-01: `.env` not copied into image — confirmed, passed at runtime via `--env-file`
- T-05-02: `/app/db` volume mount point created with `mkdir -p /app/db`
- T-05-03: Static files are public frontend assets — no secrets

## Self-Check: PASSED

- [x] `Dockerfile` exists at project root
- [x] `backend/app/main.py` has `StaticFiles` mount with `html=True` after API routes
- [x] Commit 856fabd exists: `feat(05-01): add multi-stage Dockerfile for Node 20 and Python 3.12`
- [x] Commit 1368a1d exists: `feat(05-01): add StaticFiles mount to FastAPI for Next.js static export`
- [x] `docker build -t finally . exits 0`
- [x] `GET /api/health` returns `{"status": "ok"}` from running container
- [x] `GET /` returns HTTP 200 with `<!DOCTYPE html>` from running container
