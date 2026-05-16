---
phase: 05-docker-deployment
fixed_at: 2026-05-16T13:30:00Z
review_path: .planning/phases/05-docker-deployment/05-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-05-16T13:30:00Z
**Source review:** .planning/phases/05-docker-deployment/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: CORS allows only `localhost:3000` — all production traffic blocked

**Files modified:** `backend/app/main.py`
**Commit:** c8e99a8
**Applied fix:** Changed `allow_origins=["http://localhost:3000"]` to `allow_origins=["*"]` in the CORSMiddleware configuration. This unblocks all origins including production deployments and `localhost:8000` (where the static export is served).

---

### CR-02: `.env` load path resolves incorrectly inside the Docker container

**Files modified:** `backend/app/main.py`
**Commit:** fb9e542
**Applied fix:** Guarded the `load_dotenv` call with an `if _env_file.exists():` check — the `.env` file is excluded from the Docker image via `.dockerignore` so `load_dotenv` was silently no-oping. Added `import os` and a startup warning (`logger.warning`) if `OPENROUTER_API_KEY` is absent, so missing configuration is surfaced at boot rather than discovered later at the chat endpoint. The number of `.parent` calls (3) was left unchanged — per the fix notes, this correctly resolves to `/app/.env` in the container (the project root), which is acceptable since Docker `--env-file` injects vars directly.

---

### CR-03: `start_mac.sh` crashes with `set -e` when `.env` file is absent

**Files modified:** `scripts/start_mac.sh`
**Commit:** d5526e1
**Applied fix:** Added a pre-flight `[[ ! -f "$ENV_FILE" ]]` check before the `docker run` call. If `.env` does not exist, the script prints a clear error message directing the user to copy `.env.example`, then exits with code 1. The `--env-file` argument now uses the `$ENV_FILE` variable (set once at the top of the pre-flight block) rather than an inline subshell expansion.

---

### WR-01: PowerShell script image-existence check is unreliable

**Files modified:** `scripts/start_windows.ps1`
**Commit:** ba74836
**Applied fix:** Replaced the string-truthiness check `$ImageExists = docker image inspect ...` with the exit-code pattern: `docker image inspect $Image 2>$null | Out-Null` followed by `$ImageExists = $LASTEXITCODE -eq 0`. This is reliable regardless of `$ErrorActionPreference` setting.

---

### WR-02: `.env` absent-file scenario not handled in `start_windows.ps1`

**Files modified:** `scripts/start_windows.ps1`
**Commit:** ba74836
**Applied fix:** Added `if (-not (Test-Path $EnvFile))` guard before the build/run steps. Prints a user-friendly error message and exits with code 1 if `.env` is missing. Both WR-01 and WR-02 were committed atomically in the same commit since they affect the same file.

---

### WR-03: Initial portfolio snapshot taken before market data prices are populated

**Files modified:** `backend/app/main.py`
**Commit:** 3bc3f4f
**Applied fix:** Added `await asyncio.sleep(1.0)` between `await state.market_source.start(tickers_to_track)` and the `record_portfolio_snapshot` call. This allows the simulator's first tick to run and populate `state.price_cache` before the snapshot is taken, preventing a zeroed-out first data point in the P&L chart.

---

### WR-04: `scripts/` directory not excluded from Docker build context

**Files modified:** `.dockerignore`
**Commit:** dfd83f5
**Applied fix:** Added `scripts/`, `planning/`, `*.png`, and `*.jpg` to `.dockerignore`. The `planning/` directory (distinct from the already-excluded `.planning/`) was also absent. Image files (`.png`, `.jpg`) at the project root (e.g., layout screenshots) are now excluded from the build context.

---

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-05-16T13:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
