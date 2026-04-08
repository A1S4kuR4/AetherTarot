---
name: aethertarot-reading-state
description: Model and change AetherTarot's reading runtime state for `POST /api/reading`. Use when Codex is designing or modifying canonical reading flow, question classification handoff, spread/card hydration, draft-to-structured output mapping, LangGraph node boundaries, or `session_capsule` insertion points in the reading pipeline. Do not use for tarot knowledge ingest, pure UI rendering tweaks, or generic LangGraph tutorials. This skill only serves reading-state and orchestration tasks in `apps/web/src/server/reading/`, `packages/shared-types/`, and the matching docs.
---

# AetherTarot Reading State

Treat reading state as a domain contract, not as a generic message buffer.

## Required Reads

Read these files before changing reading state or graph boundaries:

1. `docs/20-domain/interpretation-framework.md`
2. `docs/30-agent/output-schema.md`
3. `docs/30-agent/context-strategy.md`
4. `docs/40-architecture/architecture.md`
5. `docs/50-safety/safety-principles.md`
6. `apps/web/src/server/reading/service.ts`
7. `apps/web/src/server/reading/schemas.ts`
8. `packages/shared-types/src/index.ts`

## State Model

Model the runtime in these layers and keep each layer explicit:

| Layer | Owns | Current anchor |
| --- | --- | --- |
| Request input | `question`, `spreadId`, `drawnCards[]` | `ReadingRequestPayload` |
| Canonical context | `question_type`, authority spread snapshot, hydrated `DrawnCard[]` | `generateStructuredReading()` |
| Reading draft | card interpretations, themes, synthesis, guidance, follow-up, confidence | provider output |
| Safety-reviewed reading | `safety_note` plus narrowed guidance/questions when needed | `applySafetyReview()` |
| Validated product output | stable `StructuredReading` shape for API, history, replay, evals | `structuredReadingSchema` |

Treat `session_capsule` as a named extension point in the state machine. Do not improvise it inside prompts or UI-only code.

## Pipeline Rules

Keep the default execution order aligned with the current service:

1. Classify the user question.
2. Hydrate canonical spread and card context from runtime authority data.
3. Generate a structured reading draft.
4. Apply an independent safety review.
5. Validate and return the final `StructuredReading`.

If you introduce LangGraph, map nodes to this pipeline instead of inventing a second workflow language. A minimal graph should still preserve the same business stages and finish in the same schema.

## State Design Rules

- Prefer domain fields over opaque blobs. Keep state close to `StructuredReading`, `Spread`, and `DrawnCard`.
- Keep `cards[]` ordered by spread position order. Do not let node order or async execution reorder user-visible cards.
- Keep `question_type`, `themes`, `synthesis`, `reflective_guidance`, `follow_up_questions`, `safety_note`, `confidence_note`, and `session_capsule` as product-facing fields, not incidental metadata.
- Overwrite final reading fields unless accumulation is explicitly required. Most output fields are not append-only.
- Format prose inside nodes or providers, but keep state keys semantic and stable.
- Let the route layer validate transport concerns only. Do not move business truth from service back into route or UI.

## LangGraph Adaptation Rules

Use upstream LangGraph ideas only as implementation scaffolding:

- Treat shared graph state as the AetherTarot reading contract, not as a generic chat transcript.
- Use partial updates from each node; do not mutate and pass around one giant object.
- Reserve reducers for true accumulation such as internal logs or audit traces. Do not attach append reducers to public fields like `themes` or `cards` unless you want merge behavior.
- Compile back into one `StructuredReading` contract at the terminal step.
- Keep safety review as its own node or post-step. Do not bury it inside generation.

## Change Workflow

When you touch reading state:

1. Start from the user question and spread semantics, not from framework capabilities.
2. Decide which fields are transient, which are durable, and which are public API.
3. Define where `session_capsule` is produced or consumed before changing its shape or timing.
4. Update `docs/30-agent/output-schema.md` and `docs/40-architecture/architecture.md` when state boundaries or field meanings change.
5. Re-check `docs/60-evals/rubrics.md` if the output contract or synthesis logic changes.

## Boundaries

Do not:

- Fall back to markdown-only output as the primary protocol.
- Hide critical conclusions in free-form logs that frontends and history cannot consume.
- Let style preferences override spread logic or safety limits.
- Treat `session_capsule` as a raw transcript dump.
- Introduce a graph-specific state shape that diverges from the repo's documented reading shape without updating docs and consumers together.

## Done Criteria

Before finishing, verify:

1. `POST /api/reading` can still end in one stable `StructuredReading`.
2. Card order still follows spread position order.
3. Safety review still runs independently.
4. History replay would still be able to consume the returned shape.
5. Any new state field is documented in `docs/` and reflected in shared types or schema code.
