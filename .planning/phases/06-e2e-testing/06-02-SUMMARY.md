---
phase: 06-e2e-testing
plan: 02
status: complete
completed_at: "2026-05-16"
---

# Plan 06-02 Summary — E2E Test Scenarios

## What Was Done
- Created test/tests/finally.spec.ts with all 7 Playwright E2E test scenarios
- TEST-01: fresh start — default watchlist, $10k balance, prices streaming
- TEST-02: add/remove ticker from watchlist via UI
- TEST-03: buy shares — position appears, cash decreases
- TEST-04: sell shares — cash increases after partial sell
- TEST-05: heatmap and P&L chart render after first trade
- TEST-06: mocked AI chat — loading indicator, mock message, trade confirmation badge
- TEST-07: SSE disconnect/reconnect via page.route/unroute, connection status dot asserted

## Artifacts
- test/tests/finally.spec.ts (7 test scenarios, ~100 lines)

## Key Decisions
- workers=1 (sequential, shared DB state per suite run)
- page.route() for SSE disconnect simulation (no container restart needed)
- Behavioral assertions (empty state gone) not exact prices
- Mock response assertions: /Mock:/ regex, /Executed buy 1 AAPL/i regex
