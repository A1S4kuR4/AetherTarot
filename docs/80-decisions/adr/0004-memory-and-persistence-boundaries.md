# ADR-0004: Memory and Persistence Boundaries

- `status`: Accepted
- `date`: 2026-04-26
- `owner`: Codex
- `scope`: session capsule, completed reading history, future thread/session persistence, long-term memory

## Context

AetherTarot already has local completed-reading history, explicit continuity source selection, and `session_capsule` on completed readings. The next product risk is not missing storage technology. The risk is collapsing several different concepts into one vague "memory" layer:

- local history replay
- `session_capsule` continuity
- future thread/session persistence
- future long-term user memory

If these are mixed too early, memory may override the current question or current spread, leak sensitive details, or make a reading impossible to replay from its saved structured payload.

## Decision

AetherTarot will keep five continuity and persistence layers separate.

| Layer | Scope | Current status | Write rule | Read rule |
| --- | --- | --- | --- | --- |
| Current reading task state | One API request / one in-progress reading | Implemented through request payload and graph state | Built from current question, spread, draw source, drawn cards, phase, profile, and optional prior capsule | Highest priority during generation |
| Completed reading history | Local replay cache for user-visible completed readings | Implemented in `ReadingContext.tsx` via localStorage | Only Lite completed initial readings and Standard/Sober final readings are persisted | Used for history replay and explicit "continue this line" selection |
| Session capsule | Compact continuity summary from one completed reading into a later reading | Implemented as `string | null` on `StructuredReading` | Generated only for completed readings; sanitized and template-constrained | Read only when the user explicitly chooses a continuity source; lower priority than current question, spread, and draw |
| Thread/session persistence | Future server-side continuity for one reading thread or conversation | Not implemented | Must store inspectable summaries and reading references, not raw transcript by default | May support resuming a thread, but must not become user-wide memory |
| Long-term user memory | Future stable preferences and recurring patterns | Not implemented | Requires repeat evidence or explicit user authorization; never store crisis details or unverified third-party claims by default | Lowest priority personalization context; never overrides current reading or safety rules |

`reading_id` remains a reading artifact identifier. It must not be reused as a thread id, session id, or user id.

## Non-Goals

This ADR does not approve:

- service-side history persistence
- user accounts or user ids
- long-term profile storage
- memory merge implementation
- LangGraph checkpointing
- raw transcript persistence
- changing `session_capsule` from `string | null`

Those items remain backlog until a later ADR or implementation plan explicitly opens them.

## Boundary Rules

1. Current reading context always wins over memory.
2. Safety rules always win over memory.
3. A stored completed reading must remain replayable from its public `StructuredReading` payload plus saved draw metadata.
4. `session_capsule` stores continuity value, not transcript detail.
5. Incoming `prior_session_capsule` must continue to be sanitized before provider injection.
6. Thread/session identity and user identity must stay separate.
7. Local history is a replay cache, not the canonical long-term memory system.
8. Future memory merge must prefer explicit overwrite and bounded retention rules over silent accumulation.

## Consequences

This keeps P2 focused on design clarity before implementation. Future persistence can be added without changing the current `/api/reading` contract, and future long-term memory can be introduced without treating localStorage history as a user profile.

The tradeoff is that continuity remains shallow for now. That is intentional: the project should preserve schema stability and safety boundaries before adding more durable memory.

## Acceptance Criteria For Future Work

Before any service-side persistence or long-term memory work starts, the implementation must define:

- the identity being introduced (`thread_id`, `session_id`, or `user_id`)
- what data may be written
- when the data is read back
- merge, overwrite, eviction, and deletion behavior
- safety redaction behavior
- how replay remains possible from structured readings
- which contract, semantic, or e2e tests protect the boundary
