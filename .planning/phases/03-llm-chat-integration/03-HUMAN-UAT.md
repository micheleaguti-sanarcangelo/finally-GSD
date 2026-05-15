---
status: partial
phase: 03-llm-chat-integration
source: [03-VERIFICATION.md]
started: 2026-05-15T00:00:00Z
updated: 2026-05-15T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Conversation history reaches LLM in non-mock path
expected: When LLM_MOCK is not set and a real LLM call is made, the messages list sent to litellm.completion includes prior chat_messages rows (up to 20) in addition to the current user message. Verify by running with a real OPENROUTER_API_KEY and checking a multi-turn conversation maintains context.
result: [pending]

### 2. Insufficient-cash failure reported in response message
expected: When an LLM-triggered trade requires more cash than the user has, the trade is rejected, an error string is collected in actions_log, and the failure reason appears appended to the response message (not as an HTTP error). Verify by seeding cash_balance=0.01 in the DB and triggering a trade via LLM_MOCK=true or a real LLM call.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
