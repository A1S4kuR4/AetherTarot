# Thread / Session Persistence RFC

- `status`: Draft
- `date`: 2026-04-26
- `owner`: Codex
- `scope`: P2.2 design for future server-side continuity

## 1. Purpose

This RFC defines the first safe shape for future thread/session persistence. It does not approve implementation.

The design goal is to support continuity beyond localStorage without turning history, `session_capsule`, or LangGraph checkpoints into long-term user memory.

## 2. Recommendation

If AetherTarot opens server-side continuity, the first identity should be `thread_id`.

Recommended meaning:

- `thread_id` represents one user-selected reading line.
- A thread links completed readings and compact thread summaries around a coherent topic or reflection arc.
- A thread does not imply a user profile.
- A thread does not store raw transcript by default.
- A thread cannot override the current question, spread, drawn cards, or safety tier.

`session_id` should remain paused for now.

Use `session_id` only if the product later needs to resume short-lived in-progress flow state, such as a half-finished two-stage reading. It should not be introduced merely as another name for thread continuity.

## 3. Current Non-Goals

This RFC does not approve:

- adding `thread_id` to `POST /api/reading`
- adding `session_id`
- adding `user_id`
- service-side write paths
- account or auth work
- long-term user memory
- memory merge
- LangGraph checkpointing
- raw transcript persistence
- changing `session_capsule` from `string | null`

## 4. Proposed Thread Semantics

### 4.1 Thread Scope

A thread is a user-visible reading line. It may contain:

- one or more completed reading references
- each completed reading's public `StructuredReading`
- saved draw metadata needed for replay
- a compact thread summary derived from completed readings
- user-visible notes if explicitly saved by the user
- lifecycle metadata such as `created_at`, `updated_at`, and `archived_at`

A thread must not contain by default:

- raw chat transcript
- raw follow-up answer text outside the completed reading payload
- high-risk crisis details
- unverified third-party intent claims
- hidden provider prompts or chain-of-thought
- long-term user profile facts

### 4.2 Thread Read Rule

Thread context may be read only when the user explicitly continues a thread.

Provider injection must use a sanitized thread summary, not raw thread history. The injected summary is lower priority than:

1. current safety rules
2. current question
3. current spread
4. current drawn cards
5. current phase and agent profile
6. current `prior_session_capsule`

### 4.3 Thread Write Rule

A completed reading may be attached to a thread only when:

- the reading is completed
- the user has created or selected a thread
- the stored payload is replayable from `StructuredReading` plus draw metadata
- any derived thread summary has passed the same safety redaction rules as `session_capsule`

Standard/Sober initial readings must not be written as completed thread entries.

### 4.4 Thread Summary Rule

A thread summary should be compact and inspectable. It may include:

- normalized thread topic
- last completed reading id
- spread names used in the thread
- recurring themes
- 1-3 carry-forward observations
- boundary reminder

It must not include:

- raw transcript
- raw `followup_answers`
- acute safety details
- manipulative behavior details
- third-party mind-reading claims

## 5. Deletion and Lifecycle

Before implementation, the product must define at least:

| Lifecycle action | Required behavior |
| --- | --- |
| Create thread | User intentionally starts or names a reading line |
| Continue thread | User explicitly selects the thread |
| Archive thread | Thread is hidden from default view but recoverable |
| Delete thread | Thread entries and summaries are removed from server storage |
| Export/replay | Completed readings remain renderable from public structured payload plus draw metadata |

No thread storage should be introduced without an explicit delete path.

## 6. API Design Options

### Option A: Thread API Separate From Reading API

Add separate endpoints later, such as:

- `POST /api/threads`
- `GET /api/threads`
- `POST /api/threads/:threadId/readings`
- `DELETE /api/threads/:threadId`

`POST /api/reading` remains unchanged. The front end receives a sanitized thread summary and may pass it through the existing `prior_session_capsule` field until a new contract is accepted.

Pros:

- preserves current reading contract
- keeps persistence concerns out of the route
- easier to keep thread identity separate from reading identity

Cons:

- requires additional frontend orchestration
- thread continuation remains adjacent to, not inside, reading request contract

### Option B: Add `thread_id` To Reading Request Later

Add optional `thread_id` to `ReadingRequestPayload` only after thread storage, deletion, and tests exist.

Pros:

- simpler request path for future server-managed thread context
- can centralize thread summary loading in the service layer

Cons:

- changes public request contract
- stronger risk of memory silently entering readings
- requires careful tests to prove current question and safety still win

Recommendation:

Start with Option A if possible. Do not add `thread_id` to `POST /api/reading` until there is a concrete need for service-side thread summary loading.

## 7. Storage Shape Draft

If implemented later, the minimal thread storage shape should be closer to this:

```ts
type ReadingThread = {
  thread_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  summary: string | null;
  reading_ids: string[];
};

type ThreadReadingRecord = {
  thread_id: string;
  reading_id: string;
  created_at: string;
  spread_id: string;
  draw_source: "digital_random" | "offline_manual";
  drawn_cards: ReadingRequestCardInput[];
  reading: StructuredReading;
};
```

This is not yet a shared type. It is a design sketch only.

## 8. Required Tests Before Implementation

Minimum test coverage before thread persistence can ship:

| Risk | Test |
| --- | --- |
| Standard/Sober initial enters thread history | graph or thread service unit |
| Thread summary contains raw follow-up answer | semantic fixture |
| Thread summary carries crisis or manipulation detail | safety / semantic fixture |
| Thread context overrides current question | semantic fixture |
| Thread context changes card or spread authority | graph / contract |
| Thread context bypasses hard-stop safety | contract / safety regression |
| Deleted thread remains readable | thread service unit |
| Stored reading cannot replay | e2e or integration replay |

## 9. Open Questions

- Should a thread be user-named, auto-titled from the first completed reading, or both?
- Should one completed reading be allowed in multiple threads?
- Should local history be migratable into a server thread, or should server threads start fresh?
- Should thread summaries be generated by the reading graph, a separate summarizer, or a deterministic formatter?
- What is the minimum account/auth boundary before server threads are safe to store?

## 10. Decision Gate

Move from RFC to implementation only when:

- product confirms a real need for cross-device or server-side continuity
- deletion and archive behavior are accepted
- thread summary redaction is testable
- the first storage boundary is chosen
- the team accepts whether `POST /api/reading` remains unchanged or receives an optional `thread_id`

Until then, keep continuity on the current local history + explicit `session_capsule` path.
