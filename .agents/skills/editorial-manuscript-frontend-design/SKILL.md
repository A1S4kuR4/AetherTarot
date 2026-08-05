---
name: editorial-manuscript-frontend-design
description: Design or refine web interfaces in a modern manuscript and editorial style. Use for warm-paper surfaces, serif-led typography, chapter or long-form layouts, margin notes, asymmetrical editorial composition, responsive reading experiences, and replacing card-heavy template UI without changing product behavior. Do not use for brand-new visual worlds that require an unrelated style, backend work, or data-model changes.
---

# Editorial Manuscript Frontend Design

Create focused, spacious interfaces that feel edited rather than assembled: paper-like surfaces, literary typography, restrained structural color, and generous silence around content.

## Establish the boundary

- Inspect the incumbent design system, typography, component conventions, and the affected route before editing.
- Preserve real navigation, data loading, authentication, actions, and state transitions unless the request explicitly changes them.
- Reuse semantic design tokens and existing component primitives. Add tokens only when a repeated visual role cannot be expressed by the current system.
- Translate the existing content into the editorial language; do not invent product claims, replace factual copy, or turn a refinement into a feature redesign.

## Compose the page

- Treat the page as a continuous reading sequence. Use named sections, chapters, or movements only when the content has a real sequence.
- Let the primary title and reading copy lead. Use small labels, rules, page notes, and numerals as secondary orientation—not as decoration competing with the title.
- Build hierarchy with scale, alignment, measure, and empty space before reaching for containers.
- Use asymmetry when it clarifies priority: one dominant reading or action area may be balanced by a smaller note, archive, or secondary path. Do not force unrelated content into equal columns or equal cards.
- Keep reading measures comfortably narrow, while allowing the overall composition to use a broad desktop canvas.
- Use margin notes and drop caps sparingly; they should deepen the reading rhythm, not become a repeated ornament.

## Set the visual language

- Base the surface on warm paper or parchment tones, with near-black ink for primary text and a restrained vermilion, terracotta, or brick-red accent for structural emphasis.
- Use a serif family for display and reading text. Use sans-serif or monospace only for utility labels, compact metadata, or measured notation.
- Prefer hairline rules, quiet underlines, and small color marks over boxes, badges, or heavy borders.
- Make whitespace intentional: tight within a semantic group, generous between sections, and more space before a heading than after it.
- Use restrained elevation only when it explains a foreground sheet or focused state. Keep the background materially quiet.

## Reject template signals

- Avoid repeated rounded cards, equal feature tiles, pill forests, dashboard grids, generic metric blocks, and outlined-panel stacks.
- Do not add glass effects, neon, decorative gradients, light halos, dark insert pages, or unrelated large illustrations.
- Do not use monospaced type as a decorative substitute for editorial hierarchy.
- Do not add visual ornament merely to fill space; blank space is part of the composition.

## Adapt the experience

- On desktop, allow broad spreads and deliberate asymmetry. On narrow screens, collapse into one clear reading column and preserve DOM/focus order.
- Hide or simplify floating section navigation when it competes with content or touch targets.
- Keep primary actions visible without turning every action into a filled button. Use one clear primary action and quieter secondary actions.
- When a visible instruction is meant to trigger an action, implement it as a semantic, keyboard-focusable control and route it through the same handler as the equivalent direct interaction.
- Avoid accidental page-level scrollbars in bounded desktop sheets. Let only the content region that can truly overflow scroll, and test it with long content.

## Implement and verify

1. Diagnose whether the issue is hierarchy, spacing, overflow, hit testing, or state—not merely a need to move pixels.
2. Make the smallest component-local change that preserves behavior and source order.
3. Verify wide and narrow layouts, real copy lengths, keyboard focus, hover/disabled states, and any focused or revealed states the component owns.
4. Run the project’s relevant lint, typecheck, and build commands.
5. Run the available UI detector after editing front-end files, then manually inspect the built surface.

## Completion check

- The content reads as one edited composition rather than a set of app cards.
- Typography, accent color, rules, and whitespace establish a clear hierarchy.
- Desktop asymmetry collapses cleanly into mobile reading order.
- All visible controls work with pointer and keyboard input.
- Existing product behavior remains intact.
