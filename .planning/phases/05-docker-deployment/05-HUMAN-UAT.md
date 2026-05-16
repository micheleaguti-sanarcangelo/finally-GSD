---
status: partial
phase: 05-docker-deployment
source: [05-VERIFICATION.md]
started: 2026-05-16T14:00:00Z
updated: 2026-05-16T14:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Docker build succeeds
expected: `docker build -t finally .` exits 0; `docker images | grep finally` shows the image
result: [pending]

### 2. Container serves API and static frontend
expected: `docker run --rm -e OPENROUTER_API_KEY=test -p 8000:8000 finally`; `curl http://localhost:8000/api/health` → `{"status":"ok"}`; `curl http://localhost:8000/` returns HTML with `<!DOCTYPE html`
result: [pending]

### 3. SQLite DB created at volume mount path
expected: `docker exec <container> ls /app/db/finally.db` confirms the file exists after startup
result: [pending]

### 4. start_mac.sh / stop_mac.sh work correctly
expected: `./scripts/start_mac.sh` runs without error, prints `http://localhost:8000`, container starts; `./scripts/stop_mac.sh` stops and removes container, volume preserved
result: [pending]

### 5. docker compose up starts on port 8000
expected: `docker compose up` (from project root with .env present) starts the app; `curl http://localhost:8000/api/health` → `{"status":"ok"}`
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
