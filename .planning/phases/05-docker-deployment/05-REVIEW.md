---
phase: 05-docker-deployment
reviewed: 2026-05-16T13:04:47Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - Dockerfile
  - backend/app/main.py
  - scripts/start_mac.sh
  - scripts/stop_mac.sh
  - scripts/start_windows.ps1
  - scripts/stop_windows.ps1
  - docker-compose.yml
  - .env.example
  - .dockerignore
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-16T13:04:47Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase delivers the Dockerfile, deployment scripts, docker-compose, and .env.example for the FinAlly application. The core build pipeline is structurally sound — multi-stage build, uv-based Python install, static file serving. However, three critical issues were found: the CORS middleware in `main.py` allows only `localhost:3000` in production (blocking all real traffic), the `.env` file is excluded from the Docker build context via `.dockerignore` but `main.py` tries to load it at a hardcoded relative path that will never resolve inside the container, and `start_mac.sh` will crash with `set -e` when the `.env` file does not exist (no pre-flight check before passing `--env-file`). Four additional warnings cover the PowerShell script's unreliable image-existence check, an absent browser-open step promised in PLAN.md, missing `scripts/` exclusion from `.dockerignore`, and the snapshot-task startup race condition in `main.py`.

---

## Critical Issues

### CR-01: CORS allows only `localhost:3000` — all production traffic blocked

**File:** `backend/app/main.py:69-74`
**Issue:** The `CORSMiddleware` is configured with `allow_origins=["http://localhost:3000"]`. In the Docker deployment the frontend is served by FastAPI itself on the same origin as the API (port 8000), so browser requests come from `http://localhost:8000`, not port 3000. Any user opening the app from `http://localhost:8000` who triggers a CORS preflight (e.g., DELETE or POST with JSON content-type from a real browser context) will be blocked. The CORS header will be missing, causing browsers to reject the response. In any non-localhost deployment (cloud, LAN IP, domain name) every API call will be rejected.

**Fix:** Because the frontend is served as a static export by the same FastAPI process, there is no actual cross-origin scenario in production — CORS middleware is not needed at all for the single-container model. Remove the middleware for production, or broaden it correctly:

```python
# Option A — remove middleware entirely (correct for same-origin static serving)
# Do NOT add CORSMiddleware when serving static files from the same process.

# Option B — allow all origins (acceptable for a local-only dev tool with no auth)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)
```

---

### CR-02: `.env` load path resolves incorrectly inside the Docker container

**File:** `backend/app/main.py:15`
**Issue:** The application loads environment variables with:
```python
load_dotenv(Path(__file__).parent.parent.parent / ".env")
```
`__file__` resolves to `/app/backend/app/main.py` inside the container. Three `.parent` calls yield `/app/backend` → `/app` → `/` (filesystem root), so `load_dotenv` attempts to read `/.env` — a path that does not exist. The `.dockerignore` file also explicitly excludes `.env` from the build context (correct), so the file is never present in the image. This means environment variables are never loaded via `load_dotenv` in the container — the app relies entirely on Docker's `--env-file` injection at runtime. This works when users run the provided scripts (which pass `--env-file`), but `load_dotenv` silently fails, which is misleading. More critically, if someone runs the container without `--env-file`, `OPENROUTER_API_KEY` will be absent with no error at startup — only discovered later when the chat endpoint fails.

**Fix:** Since env vars are injected by Docker at runtime, remove the `load_dotenv` call entirely for the containerized path. If local development (outside Docker) needs `.env`, guard it or use a correct relative path from the repo root:

```python
# For local dev only — safe to remove if always run via Docker
_env_file = Path(__file__).parent.parent.parent.parent / ".env"
if _env_file.exists():
    load_dotenv(_env_file)
```
Note: the correct path from `main.py` to the project root is **four** `.parent` calls: `main.py` → `app/` → `backend/` → project root. The current code uses only three.

---

### CR-03: `start_mac.sh` crashes with `set -e` when `.env` file is absent

**File:** `scripts/start_mac.sh:29-34`
**Issue:** The script uses `set -euo pipefail` at the top and passes `--env-file "$(dirname "$0")/../.env"` to `docker run`. If the `.env` file does not exist, `docker run` exits with a non-zero code and `set -e` aborts the script. There is no pre-flight check confirming `.env` exists before attempting to start the container. A new user who clones the repo and runs `start_mac.sh` before copying `.env.example` to `.env` will see a terse Docker error with no guidance.

**Fix:** Add an explicit check with a helpful error message before the `docker run` call:

```bash
ENV_FILE="$(dirname "$0")/../.env"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: .env file not found at $ENV_FILE"
    echo "Copy .env.example to .env and fill in your API keys before starting."
    exit 1
fi

docker run -d \
    --name "$CONTAINER" \
    -v "$VOLUME:/app/db" \
    -p "$PORT:8000" \
    --env-file "$ENV_FILE" \
    "$IMAGE"
```

---

## Warnings

### WR-01: PowerShell script image-existence check is unreliable

**File:** `scripts/start_windows.ps1:15-18`
**Issue:** The image-existence check uses:
```powershell
$ImageExists = docker image inspect $Image 2>$null
if ($Build -or -not $ImageExists) {
```
`docker image inspect` returns a JSON array even for a found image; the variable will be a non-empty string. However, when the image does not exist, `docker image inspect` exits with code 1 and outputs nothing to stdout (stderr is redirected to null). In PowerShell, an empty/null string is falsy, so `-not $ImageExists` would be `$true` correctly. But if `$ErrorActionPreference = "Stop"` is set in the calling shell, the non-zero exit code from `docker image inspect` on a missing image will throw a terminating error before the assignment. The bash equivalent guards with `&>/dev/null` and tests exit code; the PowerShell version does not use `$LASTEXITCODE`. This is fragile and will misfire in stricter PowerShell environments.

**Fix:** Use `$LASTEXITCODE` for reliable exit-code checking:

```powershell
docker image inspect $Image 2>$null | Out-Null
$ImageExists = $LASTEXITCODE -eq 0
if ($Build -or -not $ImageExists) {
    Write-Host "Building $Image image..."
    docker build -t $Image $ProjectRoot
}
```

---

### WR-02: `.env` absent-file scenario not handled in `start_windows.ps1` either

**File:** `scripts/start_windows.ps1:35-36`
**Issue:** Same root cause as CR-03, applied to the Windows script. There is no check that `$EnvFile` exists before passing it to `docker run --env-file`. Docker on Windows will emit an error and the script will exit without user-friendly guidance.

**Fix:**
```powershell
if (-not (Test-Path $EnvFile)) {
    Write-Host "ERROR: .env file not found at $EnvFile"
    Write-Host "Copy .env.example to .env and fill in your API keys before starting."
    exit 1
}
```

---

### WR-03: Initial portfolio snapshot taken before market data prices are populated

**File:** `backend/app/main.py:52-54`
**Issue:** In the `lifespan` function, `record_portfolio_snapshot` is called immediately after `await state.market_source.start(tickers_to_track)`. The `start()` call launches the background market task but prices may not yet be in `state.price_cache` at the moment of the snapshot (the simulator's first tick runs asynchronously). The snapshot will record a portfolio value calculated with zero or missing prices, producing an incorrect first data point in the P&L chart.

**Fix:** Add a short yield to allow the market source's first tick to populate the cache before snapshotting, or skip the initial snapshot (the 30-second loop will produce the first real snapshot shortly):

```python
# Allow the first market tick to complete before snapshotting
await asyncio.sleep(1.0)
try:
    record_portfolio_snapshot(get_db_path(), state.price_cache)
except Exception:
    logger.exception("Initial snapshot failed")
```

---

### WR-04: `scripts/` directory not excluded from Docker build context

**File:** `.dockerignore`
**Issue:** The `.dockerignore` excludes planning artifacts, `.claude/`, `.gsd/`, and test files, but does not exclude `scripts/`. The shell scripts are small, but consistency with the intention of keeping the image lean argues for excluding them. More importantly, the `planning/` directory is also absent from `.dockerignore` (`.planning/` is excluded, but the project docs reference `planning/` as the real directory name — if both exist, the plain `planning/` directory is copied into the build context unnecessarily).

**Fix:**
```
# Add to .dockerignore
scripts/
planning/
*.png
*.jpg
```

---

## Info

### IN-01: `start_mac.sh` does not open the browser (PLAN.md promised this)

**File:** `scripts/start_mac.sh:36-38`
**Issue:** PLAN.md section 11 states the start script should "optionally open the browser." The script prints the URL but makes no attempt to open it. This is a missing feature against the specification, not a runtime bug.

**Fix:** Add an optional browser-open step at the end:

```bash
echo "FinAlly is running at http://localhost:$PORT"
echo "Stop with: ./scripts/stop_mac.sh"

# Open browser if on macOS
if command -v open &>/dev/null; then
    open "http://localhost:$PORT"
fi
```

---

### IN-02: `.env.example` placeholder value for `OPENROUTER_API_KEY` looks like a real key

**File:** `.env.example:2`
**Issue:** The placeholder `OPENROUTER_API_KEY=your-openrouter-api-key-here` is clear, but some secret scanners trigger on the key name combined with any non-empty value. The conventional pattern is an empty value or a `<placeholder>` style value that cannot be mistaken for a real credential.

**Fix:**
```bash
OPENROUTER_API_KEY=<your-openrouter-api-key>
```

---

_Reviewed: 2026-05-16T13:04:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
