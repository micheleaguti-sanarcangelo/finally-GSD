---
phase: 05-docker-deployment
plan: "02"
subsystem: infrastructure
tags: [docker, scripts, shell, powershell, docker-compose]
dependency_graph:
  requires: [05-01]
  provides: [start-stop-scripts, docker-compose, env-example, dockerignore]
  affects: [05-03]
tech_stack:
  added: [docker-compose-v2]
  patterns: [idempotent-scripts, named-volumes]
key_files:
  created:
    - scripts/start_mac.sh
    - scripts/stop_mac.sh
    - scripts/start_windows.ps1
    - scripts/stop_windows.ps1
    - docker-compose.yml
    - .env.example
    - .dockerignore
  modified: []
decisions:
  - "All four scripts use identical constants: image=finally, container=finally-app, volume=finally-data, port=8000"
  - "docker-compose.yml uses explicit volume name (name: finally-data) so compose and shell scripts share the same named volume"
  - "No version: key in docker-compose.yml — docker compose v2 does not require it"
  - ".dockerignore excludes .planning/, test/, .claude/, .gsd/ to keep build context lean"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-16"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 5 Plan 02: Operational Scripts and docker-compose Summary

Four idempotent start/stop scripts (Mac shell + Windows PowerShell), a docker-compose convenience wrapper, .env.example template, and .dockerignore — all referencing consistent image/container/volume names so users can switch between shell scripts and compose without conflict.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Mac/Linux scripts, .env.example, .dockerignore | b6a8770 | scripts/start_mac.sh, scripts/stop_mac.sh, .env.example, .dockerignore |
| 2 | Windows scripts and docker-compose.yml | 006aefa | scripts/start_windows.ps1, scripts/stop_windows.ps1, docker-compose.yml |

## What Was Built

### Task 1: Mac/Linux Scripts and Supporting Files

**scripts/start_mac.sh**
- Parses `--build` flag to force image rebuild
- Auto-builds image if not present (`docker image inspect` check)
- Stops and removes existing container before starting (idempotent)
- Starts with `docker run -d --name finally-app -v finally-data:/app/db -p 8000:8000 --env-file .env finally`
- Prints `http://localhost:8000` on success
- Executable bit set via `git update-index --chmod=+x`

**scripts/stop_mac.sh**
- Checks if container exists before stopping (idempotent — no error if not running)
- Runs `docker stop` then `docker rm` preserving the `finally-data` named volume
- Executable bit set

**.env.example** — Three placeholder vars: `OPENROUTER_API_KEY`, `MASSIVE_API_KEY=`, `LLM_MOCK=false`

**.dockerignore** — Excludes: `node_modules/`, `frontend/.next/`, `frontend/out/`, `__pycache__/`, `.venv/`, `.git/`, `.env`, `db/*.db`, `.planning/`, `test/`, `.claude/`, `.gsd/`

### Task 2: Windows Scripts and docker-compose.yml

**scripts/start_windows.ps1**
- PowerShell 5.1+ (`#Requires -Version 5.1`)
- `param([switch]$Build)` for optional image rebuild
- Computes `$ProjectRoot` via `Split-Path` for portable .env path resolution
- Same logic as shell script: inspect → build if needed → stop existing → start

**scripts/stop_windows.ps1**
- Mirrors stop_mac.sh logic in PowerShell syntax
- `docker container inspect` check before stopping

**docker-compose.yml**
- `build: .` — builds from Dockerfile in project root
- `image: finally` — names the built image to match shell scripts
- `container_name: finally-app` — same container as shell scripts
- `volumes: finally-data: name: finally-data` — explicit name prevents compose from creating `finally-gsd_finally-data` instead
- `restart: unless-stopped`
- Validated with `docker compose config` (exits 0)

## Verification Results

| Check | Result |
|-------|--------|
| `ls scripts/` shows all four files | PASS |
| `cat .env.example` shows all three vars | PASS |
| `grep .env .gitignore` — .env is gitignored | PASS |
| `grep -r "finally-app" scripts/` — all four scripts match | PASS |
| `docker compose config` exits 0 | PASS |
| All scripts: image=finally, container=finally-app, volume=finally-data, port=8000 | PASS |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All scripts are fully operational.

## Threat Flags

None. Threat model items addressed:
- T-05-04: `.env` excluded from .dockerignore and already in .gitignore; `.env.example` committed with placeholders only
- T-05-05: Scripts run with user's Docker daemon permissions — accepted
- T-05-06: `restart: unless-stopped` — accepted for single-user local app

## Self-Check: PASSED

- [x] `scripts/start_mac.sh` exists and is executable (mode 100755 in git)
- [x] `scripts/stop_mac.sh` exists and is executable (mode 100755 in git)
- [x] `scripts/start_windows.ps1` exists
- [x] `scripts/stop_windows.ps1` exists
- [x] `docker-compose.yml` exists, `docker compose config` exits 0
- [x] `.env.example` exists with OPENROUTER_API_KEY, MASSIVE_API_KEY, LLM_MOCK
- [x] `.dockerignore` exists with node_modules/, .git/, db/*.db, .env
- [x] `.env` is in `.gitignore` (line 138)
- [x] Commit b6a8770 exists: `feat(05-02): add Mac/Linux start/stop scripts, .env.example, and .dockerignore`
- [x] Commit 006aefa exists: `feat(05-02): add Windows PowerShell scripts and docker-compose.yml`
