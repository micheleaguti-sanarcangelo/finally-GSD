# Phase 3: LLM Chat Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 3-LLM Chat Integration
**Areas discussed:** LLM failure handling, Conversation history depth, Partial trade execution, Module structure

---

## LLM Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Return 200 + fallback message | Catch exception, return graceful fallback message. Consistent response shape for frontend. | ✓ |
| Return 503 Service Unavailable | HTTP error when LLM is down. Frontend must handle both 200 and 5xx. | |
| You decide | Leave to planning agent. | |

**User's choice:** "You decide" → Claude applied best practice: always 200 for chat UIs
**Notes:** Malformed structured output also falls through to the same 200 + fallback path.

---

## Conversation History Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Last 20 messages | ~10 exchanges. Hard limit, no token counting. Industry norm. | ✓ |
| Last 10 messages | ~5 exchanges. Context lost quickly for multi-turn conversations. | |
| You decide | Leave to planning agent. | |

**User's choice:** "You decide" → Claude picked last 20 (hard cap, no token counting needed)
**Notes:** Simple SQL `LIMIT 20 ORDER BY created_at ASC`.

---

## Partial Trade Execution

| Option | Description | Selected |
|--------|-------------|----------|
| Execute others, report failure in message | Best-effort: each trade independent. Collect errors. Report all results. | ✓ |
| Abort all on any failure | Atomic: one failure cancels everything. | |
| You decide | Leave to planning agent. | |

**User's choice:** "You decide" → Claude picked best-effort (consistent with PLAN.md §9 hint)
**Notes:** Watchlist changes follow the same pattern.

---

## Module Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single app/api/chat.py | Route + prompt + LLM call + execution all inline. | ✓ |
| Split: chat.py + llm.py | Separate service module for LLM logic. | |
| You decide | Leave to planning agent. | |

**User's choice:** "You decide" → Claude picked single file (lean-code preference + single endpoint)
**Notes:** `record_portfolio_snapshot` imported from `app.api.portfolio` to avoid duplication.

---

## Claude's Discretion

All four gray areas delegated with "You decide". Claude selected best-practice defaults:
- 200 + fallback for LLM failures (chat UI convention)
- Last 20 messages history (hard cap, no token counting)
- Best-effort trade execution (matches PLAN.md §9)
- Single `chat.py` file (matches lean-code preference)

## Deferred Ideas

None — discussion stayed within phase scope.
