---
name: ingest-wiki
description: Compile unstructured tarot source material from `knowledge/raw/` into governed Markdown pages under `knowledge/wiki/` that conform to `knowledge/AGENTS.md`. Use when Codex needs to ingest raw books or notes, create or revise card/concept/spread pages, register new source IDs, merge multi-source interpretations, or synchronize `knowledge/index.md` and `knowledge/log.md` after wiki ingest or lint work.
---

# Ingest Wiki

## Overview

Turn loose source material in `knowledge/raw/` into structured, source-attributed wiki pages for AetherTarot's knowledge layer. Keep `raw/` immutable, treat `wiki/` as compiled living knowledge, and keep the governance files in sync after every structural write.

## Required Reads

Read these files before editing `knowledge/`:

1. `knowledge/AGENTS.md`
2. `knowledge/index.md`
3. `knowledge/log.md`
4. `docs/20-domain/interpretation-framework.md`

Load [references/system-prompt.md](references/system-prompt.md) when you want a reusable system prompt for a delegated agent or an external LLM.

## Page Routing

Route each target into exactly one wiki type:

| Target | Directory | File naming rule |
| --- | --- | --- |
| Major arcana card | `knowledge/wiki/major-arcana/` | `<card-id>.md` such as `the-fool.md` |
| Minor arcana card | `knowledge/wiki/minor-arcana/<suit>/` | `<card-id>.md` such as `two-of-wands.md` |
| Tarot concept | `knowledge/wiki/concepts/` | kebab-case concept slug such as `four-elements.md` |
| Spread knowledge | `knowledge/wiki/spreads/` | kebab-case spread slug such as `celtic-cross.md` |

If one source chapter covers multiple entities, split it into multiple wiki pages instead of dumping the whole chapter into one file.

## Workflow

### 1. Scope the ingest

- Identify the exact `knowledge/raw/` source files and the entities to compile.
- Decide whether the task is card-by-card, concept-driven, spread-driven, or lint/maintenance.
- Work in small coherent batches when the source covers many entities.

### 2. Check governance prerequisites

- Confirm the source file has a registered source ID in `knowledge/AGENTS.md`.
- Add the source registry row first if a new raw file is being introduced.
- Inspect the target wiki page if it already exists and merge with it instead of replacing it.

### 3. Extract and synthesize

- Separate source-grounded content from your own synthesis.
- Prefer synthesis over copy-paste; keep claims close to `[来源: XXX]` markers.
- Preserve disagreements between authors in the dedicated "多源视角与争议" or "多源视角" section.
- Use `docs/20-domain/interpretation-framework.md` only as a synthesis aid for useful reflective framing, not as a license to move product behavior rules into `knowledge/wiki/`.

### 4. Write the page

- Use the exact page template required by `knowledge/AGENTS.md`.
- Keep frontmatter fields limited to the schema for that page type.
- Write the body in Chinese.
- Show card titles as `中文名 (English Name)` in the title or first explicit mention.
- Use relative Markdown links for cross references.
- Keep `last_updated` in `YYYY-MM-DD`.

### 5. Update governance files

- Update `knowledge/index.md` when a new physical wiki page is created or coverage status changes.
- Prepend a new entry to `knowledge/log.md` for every structural write with the correct operation type.
- If the ingest added a new source ID, keep `knowledge/AGENTS.md` and page frontmatter `sources` arrays aligned.

## Writing Rules

- Keep `knowledge/raw/` read-only.
- Keep `knowledge/wiki/` objective and domain-focused.
- Do not put product policy, safety disclaimers, or runtime behavior rules into wiki pages. Those belong in `docs/`.
- Do not flatten meaningful source differences into a single "official" claim when the sources disagree.
- Do not invent frontmatter keys, source IDs, or cross references.
- Do not remove existing sourced content unless it is clearly duplicate, contradicted by the current schema, or explicitly requested.

## Quality Check

Before finishing, verify:

1. The page is routed into the correct directory and uses kebab-case naming.
2. Frontmatter matches the schema and `sources` only contains registered IDs.
3. Required second-level sections are present for the page type.
4. Cross references use relative links and point to real wiki pages.
5. `knowledge/index.md` reflects the created pages.
6. `knowledge/log.md` contains a new top entry for the operation.
7. The page stays within the `knowledge/` boundary and does not smuggle in product or safety policy.

## Failure Handling

Stop and explain the blocker when:

- The target entity or page type is unclear.
- The raw source is missing, unreadable, or not yet registered.
- The requested content belongs in `docs/` rather than `knowledge/wiki/`.
- The ingest would require changing safety policy, interpretation policy, or runtime contracts outside the knowledge layer.

## Example Requests

- `Use $ingest-wiki to ingest knowledge/raw/78度的智慧（英豪译）.md 中关于愚者的内容，生成或更新对应 wiki 页面，并同步 index/log。`
- `Use $ingest-wiki to compile the four-elements concept page from knowledge/raw/塔罗全书修订版.md.`
- `Use $ingest-wiki to lint knowledge/wiki, check missing source IDs, and reconcile knowledge/index.md coverage.`
