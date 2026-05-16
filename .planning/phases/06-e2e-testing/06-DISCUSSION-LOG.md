# Phase 6: E2E Testing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 06-e2e-testing
**Areas discussed:** All four gray areas — decided by Claude per user instruction ("scegli tu sulla base delle best practices")

---

## Test Isolation

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh DB per test | Reset state between each individual test (API endpoint or container restart) | |
| Sequential shared state | Tests run in order, each builds on the previous | |
| Single fresh run | Ephemeral anonymous volume per CI run, tests ordered but container starts once | ✓ |

**User's choice:** "You decide based on industry best practices"
**Notes:** Ephemeral volume avoids reset-endpoint complexity while keeping tests reproducible. The 7-test suite is small enough that container restart per CI run is acceptable.

---

## SSE Disconnect Simulation (TEST-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Container restart | Stop/start the app container mid-test | |
| page.route() interception | Abort SSE route in browser, then unroute to reconnect | ✓ |
| Manual network throttling | DevTools Network emulation | |

**User's choice:** "You decide based on industry best practices"
**Notes:** `page.route()` is deterministic and fast; container restart introduces Docker lifecycle timing unpredictability.

---

## Assertion Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Element presence only | Assert elements exist (heatmap renders, chart renders) | |
| Data-driven exact values | Assert exact prices, P&L values, cash amounts | |
| Behavioral outcomes | Assert outcomes (cash decreased, position row appeared) without exact values | ✓ |

**User's choice:** "You decide based on industry best practices"
**Notes:** Exact price assertions would be flaky due to ~500ms price updates. Behavioral assertions give confidence without brittleness.

---

## LLM Mock Response Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Text-only | Mock returns message only, no trade actions | |
| Text + trade | Mock returns message AND a buy trade to exercise full pipeline | ✓ |
| Text + watchlist change | Mock returns message AND a watchlist add | |

**User's choice:** "You decide based on industry best practices"
**Notes:** Including a trade in the mock response exercises the full auto-execute pipeline and verifies the inline confirmation pill — the core E2E value of TEST-06.

---

## Claude's Discretion

- Playwright config file location and reporter format
- Flat vs. describe-block test structure (chose flat for simplicity)
- Wait strategy for SSE price elements (waitForSelector with 10s timeout)
- Exact `data-testid` attribute naming convention

## Deferred Ideas

None — discussion stayed within phase scope.
