# Phase 6: E2E Testing - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Playwright E2E test suite covering all 7 user scenarios (TEST-01 through TEST-07), runnable in CI via a dedicated `test/docker-compose.test.yml` that spins up the app container plus a Playwright container. All tests use `LLM_MOCK=true` — no real API keys required.

</domain>

<decisions>
## Implementation Decisions

### Test Isolation
- **D-01:** Single fresh ephemeral DB per full test-suite run. Container starts once; SQLite volume is anonymous (not named), so it is destroyed on `docker compose down`. Tests run sequentially in documented order (TEST-01 → TEST-07). No inter-test reset endpoint required.
- **D-02:** The anonymous volume pattern guarantees a seeded, clean state on every CI run without any reset API or teardown logic.

### SSE Reconnection Simulation (TEST-07)
- **D-03:** Use `page.route()` network interception — abort the SSE route to simulate disconnect, then unroute to allow EventSource to reconnect. Do NOT restart the app container (slow, timing-sensitive). This keeps TEST-07 deterministic and fast.

### Assertion Depth
- **D-04:** Behavioral assertions: verify outcomes, not exact values. After buying 10 shares, assert cash balance decreased and a position row appeared — do not assert the exact price (prices change every ~500ms and would be flaky). Use `data-testid` selectors where available; fall back to text/role selectors.
- **D-05:** Portfolio visualization (TEST-05): assert that the heatmap container and P&L chart elements are visible and non-empty, not specific pixel colors or exact chart values.

### LLM Mock Response Shape (TEST-06)
- **D-06:** The deterministic mock returns a response that includes BOTH a text message AND a trade, e.g.: `{ "message": "Bought 5 shares of AAPL for you.", "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 5}], "watchlist_changes": [] }`. This exercises the full pipeline: LLM response → auto-execute trade → inline trade confirmation pill on the frontend.

### Security & Test Infrastructure
- **D-07:** `test/docker-compose.test.yml` uses an isolated Docker bridge network. The playwright service connects to the app service by internal service name (`http://app:8000`), not `localhost`. No host network mode.
- **D-08:** Only env var required in tests: `LLM_MOCK=true`. Use a dummy value for `OPENROUTER_API_KEY` (e.g., `test-key`) so the app starts without warnings, but no real key is needed or stored.
- **D-09:** The anonymous volume for the test DB is defined in `docker-compose.test.yml` without a `name:` field, ensuring it is ephemeral and not shared with the production named volume (`finally-data`).

### CI Exit Strategy
- **D-10:** `docker compose -f test/docker-compose.test.yml up --exit-code-from playwright` is the canonical test command. The playwright service exits with the Playwright test exit code. The app service uses a `healthcheck` so Playwright waits for the backend to be ready before tests start.

### Claude's Discretion
- Playwright config file location (`test/playwright.config.ts`) and reporter format (HTML + console) — standard Playwright defaults apply.
- Whether to use `test.describe` blocks or flat test structure — flat structure preferred for 7 simple sequential scenarios.
- Exact wait strategy for SSE prices to appear in TEST-01 — use `page.waitForSelector` on the price cells with a reasonable timeout (10s).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Spec
- `planning/PLAN.md` §12 — E2E testing strategy: docker-compose.test.yml, LLM_MOCK, 7 key scenarios
- `.planning/ROADMAP.md` §Phase 6 — scope, requirements TEST-01 through TEST-07, success criteria

### Backend (app under test)
- `backend/app/main.py` — FastAPI entrypoint, lifespan, health endpoint at `GET /api/health`, SSE at `GET /api/stream/prices`
- `backend/app/api/chat.py` — LLM_MOCK implementation: what the mock returns (structure to match D-06)
- `backend/app/api/portfolio.py` — trade execution endpoint `POST /api/portfolio/trade`, portfolio state `GET /api/portfolio`
- `backend/app/api/watchlist.py` — watchlist CRUD endpoints

### Docker Infrastructure
- `docker-compose.yml` — production compose reference (test compose mirrors its structure, adds playwright service)
- `Dockerfile` — multi-stage build that produces the `finally` image used in test compose

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/tests/conftest.py` — minimal pytest fixture; E2E tests use Playwright (not pytest), so no direct reuse but shows project test style
- `backend/app/api/chat.py` LLM_MOCK branch — returns deterministic JSON; the mock response shape must be updated to include a trade (D-06) if it currently returns text-only

### Established Patterns
- Backend tests use `uv run --extra dev pytest` — E2E tests use a separate Playwright container, no overlap
- SQLite lazy-init: the DB is created on first request (`init_db()` in lifespan) — fresh container = fresh seed data automatically

### Integration Points
- `/api/health` — readiness probe for the app container `healthcheck` in `docker-compose.test.yml`
- `/api/stream/prices` — SSE endpoint targeted by TEST-07 `page.route()` interception
- `/api/portfolio/trade` — triggered indirectly via UI in TEST-03, TEST-04, TEST-06
- `/api/watchlist` — targeted by TEST-02 add/remove flow

</code_context>

<specifics>
## Specific Ideas

- User delegated all implementation decisions to Claude; follow industry best practices throughout
- Security emphasis: isolated Docker bridge network, ephemeral volume, dummy API key pattern
- The mock LLM response (D-06) must include a trade so TEST-06 verifies the inline confirmation pill — this may require updating `backend/app/api/chat.py`'s mock branch if it currently returns text-only

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-E2E Testing*
*Context gathered: 2026-05-16*
