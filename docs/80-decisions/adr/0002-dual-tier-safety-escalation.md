# ADR 0002: Dual-Tier Safety Escalation Architecture

## Status
Accepted

## Context
AetherTarot deals with subjective and often emotionally vulnerable user queries. Previously, safety was mitigated strictly via text-based instructions or late-stage rendering warnings, supplemented by a brittle front-end regex that could easily be bypassed. This led to users externalizing major life decisions to the LLM (outsourcing) and relying on the system as a primary emotional/decision crutch.

During our UX remaining risks review (`docs/10-product/ux-remaining-risk-review-2026-04-09.md`), we established that safety mechanisms must be structured, deterministic, and built into the backend service pipeline, rather than relying on UI layers like `RitualView`. Furthermore, reacting to all policy violations with a hard error (`403 Forbidden`) disrupts the user experience for queries that, while asking for a decision, do not pose immediate life-threatening danger.

## Decision
We are implementing a **Dual-Tier Safety Escalation Mechanism** deep within the `service.ts` pipeline, driven by the `safety.ts` boundary analyzer.

### Tier 1: Hard Stop (Crisis & Manipulation)
- **Criteria**: Queries indicating self-harm, immediate danger, medical emergencies, or attempts to manipulate/control third parties.
- **Action**: The `safety.ts` analyzer throws a `SafetyInterceptError` before the reading request is dispatched to the LLM provider.
- **Response**: The `route.ts` catches this and returns an `HTTP 403 Forbidden` with a `SafetyInterceptErrorPayload`.
- **Frontend Behavior**: The application halts the ritual and presents an impassable Reality Referral/Crisis pane.

### Tier 2: Sober Check (Major Decision Outsourcing)
- **Criteria**: Queries that ask the tarot to make a major real-life decision (e.g., "Should I quit my job?", "Should I break up?"), which outsources personal agency but does not trigger a Crisis.
- **Action**: The `safety.ts` analyzer detects the intent and attaches a `sober_check` prompt/metadata to the pipeline. The LLM processes the reading with instructions to generate a "safety-downgraded" interpretation.
- **Response**: The reading completes successfully (`HTTP 200 OK`) but the `StructuredReading` payload is fortified with the `sober_check` string.
- **Frontend Behavior**: The `InterpretationView` detects the `sober_check` property and covers the interpretation with an interactive friction barrier (Sober Anchor), forcing the user to manually type an answer reflecting their own agency before revealing the reading.

## Consequences
### Positive
- Clearly delineates genuine crises from dependency behaviors.
- Implements safety boundaries consistently at the API level, rather than trusting various front-end views to enforce it.
- Re-anchors the user's perception of the product from an "all-knowing decision maker" to a "reflective sounding board" through interactive friction.

### Negative
- Increases latency slightly, as the backend must evaluate the prompt classification before reading generation.
- Adds complexity to the Next.js API layer and `ReadingContext` payload parsing.
- Evaluation sets and mock schemas need to be updated to support and validate the expected `sober_check` behaviors.
