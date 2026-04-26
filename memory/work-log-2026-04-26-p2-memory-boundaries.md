# Work Log: P2 Memory / Persistence Boundary Design

- `date`: `2026-04-26`
- `owner`: `Codex`
- `scope`: P2 long-term continuity boundary design

## 1. Context

After the P1 experience and runtime alignment pass, the next useful step is not more spread expansion. The main risk is that future continuity work could collapse local history, `session_capsule`, thread persistence, and long-term user memory into one vague memory layer.

This work starts P2 as a design-boundary task only.

## 2. Completed

- Added `docs/80-decisions/adr/0004-memory-and-persistence-boundaries.md`.
- Updated `docs/30-agent/context-strategy.md` with the P2 layer model:
  - current reading task state
  - local completed history
  - `session_capsule`
  - future thread/session persistence
  - future long-term user memory
- Updated `docs/40-architecture/architecture.md` to document future persistence as a separate, not-yet-implemented layer.
- Updated `docs/30-agent/output-schema.md` to clarify that P2 does not add `thread_id`, `session_id`, `user_id`, `memory_profile`, or `memory_merge` fields.
- Updated `docs/60-evals/rubrics.md` with regression checks for capsule and future persistence boundaries.
- Updated current priority docs to mark P2 boundary design as started while service-side persistence remains paused.
- Added `docs/30-agent/memory-persistence-roadmap.md` to split P2 into implementation-safe phases and a test matrix.
- Completed the P2.1 current-baseline capsule hardening pass:
  - added graph contract assertions for capsule section format, maximum length, and identity-field absence
  - added graph contract coverage for unsafe provider guidance redaction before capsule attachment
  - tightened completed capsule line normalization so `用户补充` labels and acute emotional details such as `崩溃` are not carried forward
- Added `docs/30-agent/thread-session-rfc.md` as the P2.2 Thread / Session RFC draft.

## 3. Boundary Decisions

- `session_capsule` remains `string | null`.
- `session_capsule` is a completed-reading continuity summary, not a thread id, user id, profile memory, or transcript.
- `ReadingHistoryEntry[]` in localStorage remains a replay cache, not canonical long-term memory.
- `reading_id` remains a reading artifact id and must not be reused as `thread_id`, `session_id`, or `user_id`.
- Future thread/session persistence and long-term memory require a later implementation plan that defines identity, write rules, read rules, merge or overwrite behavior, eviction or deletion behavior, safety redaction, and tests.
- The next safe code-level P2 candidate is capsule contract hardening, not database persistence.
- Capsule contract hardening is now complete for the current `string | null` baseline; the next step should return to observation or P2.2 design, not persistence implementation.
- P2.2 RFC recommends `thread_id` as the first future server-side continuity identity, representing a user-selected reading line. `session_id` remains paused unless unfinished short-lived flow recovery becomes a product need.

## 4. Explicitly Not Done

- No service-side history persistence.
- No long-term user profile.
- No memory merge.
- No LangGraph checkpointing.
- No schema change to `StructuredReading`.
- No runtime code change.
- No new identity field in request or response.
- No service-side write path.

## 5. Verification

This was a documentation and architecture boundary pass. No runtime behavior was changed.

Recommended checks for the next code-changing persistence task:

- focused graph / semantic fixtures for capsule timing and sanitization
- contract tests for any new identity fields
- e2e history replay and explicit continuity selection
- safety tests for memory redaction and current-question priority

Current verification:

- `npm run test:contract -w @aethertarot/web -- src/server/reading/__tests__/graph.contract.spec.ts --pool=threads`: `22/22`
- `npm run test:contract -w @aethertarot/web -- src/server/reading/__tests__/semantic-fixtures.spec.ts --pool=threads`: `12/12`
- Note: the first focused graph run passed assertions but exited non-zero because Vitest/Tinypool hit a Windows `kill EPERM` worker cleanup error. Re-running with `--pool=threads` avoided the cleanup issue.

## 6. Next Step

Recommended next P2 task, only if product need is clear:

- Turn P2.2 Thread / Session RFC into an implementation plan

Keep it narrow:

- preserve the RFC recommendation that `thread_id` is the first candidate identity
- define storage boundary, API option, deletion UX, and tests before code changes
- keep `session_capsule` as `string | null` unless a separate schema-change plan is accepted
- do not add service persistence until the RFC is accepted
