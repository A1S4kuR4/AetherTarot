# AetherTarot Frontend Validation Matrix

Run this after any user-facing frontend change. Primary viewports: **1440px desktop** and **390×844 mobile** (beta main-flow contract). Mark each row N/A only with a stated reason.

How to run: `npm run dev` (or the built app), plus targeted Playwright/spec tests for touched logic; altar geometry changes must run the `ritual-layout` specs.

## 1. Viewport & layout

| Check | 1440px desktop | 390px mobile |
| --- | --- | --- |
| No body-level horizontal scroll; large spreads use internal track or scale-down | ☐ | ☐ |
| Locked workspaces hold: home snap `calc(100dvh - 4rem)`, `/new` internal scroll, ritual stage | ☐ | falls back to natural scroll ☐ |
| Sticky/fixed elements (topbar 4rem, mobile action bar, reading anchor strip, pagination dots) don't occlude content or focus targets | ☐ | ☐ |
| Home: one section per wheel gesture; dots track active chapter; mobile CTA pill hidden on final chapter | ☐ | ☐ |
| `/new`: desktop actions in settings column vs mobile fixed bar — never both; scroll-hint fade only when columns overflow | ☐ | ☐ |
| Low-height desktop (≤700px) `/new` falls back to natural scrolling | ☐ | N/A |
| Safe-area insets respected on mobile fixed bars | N/A | ☐ |

## 2. Input & content extremes

| Check | Where | Pass |
| --- | --- | --- |
| 200-char question + long spread/profile names: no overflow, no clipped controls | `/new` | ☐ |
| Long interpretation: chapter rhythm holds, sidebar anchors track, collapsed evidence/radar still collapsed by default | `/reading` | ☐ |
| Empty states: no question (start disabled, quick draw still available), no history, no spread selected | `/new`, `/reading` | ☐ |
| Loading (3-stage), error + retry, safety intercept, sober check gate (≥5 chars) render in the correct funnel order | `/reading` | ☐ |
| Completion states: plaque count full, success dot, auto-advance to reveal | `/ritual/draw` | ☐ |

## 3. Spread & card semantics

| Check | Pass |
| --- | --- |
| All five spreads render with their semantic coordinates: `single`, `holy-triangle`, `four-aspects`, `seven-card`, `celtic-cross` (challenge rotated 90° over core, staff column) — on ritual, reveal, and reading plate | ☐ |
| 7/10-card spreads: position labels hidden where they would collide; whole field scales down instead of reflowing or overlapping | ☐ |
| Upright vs reversed: image rotated 180° + indigo badge/mark; orientation label rule flips side | ☐ |
| Major Arcana: terracotta frame + radial glow; never confused with reversed styling | ☐ |
| Card frames keep 1:1.7 aspect on every route; proportional radius/padding geometry only in ritual fan, slots, and flight — reveal/plate frames keep their own fixed metrics | ☐ |
| Card image alt text includes position, name, orientation | ☐ |

## 4. Keyboard, focus, assistive tech

| Check | Pass |
| --- | --- |
| Full flow operable by keyboard only: nav, chapter dots, catalogue selection, hold-CTA (Enter/Space triggers immediately — no hold), dialog confirm/cancel | ☐ |
| Focus ring visible everywhere (`:focus-visible` halo); contrast holds on both Paper and Midnight | ☐ |
| Quick draw overlay: focus enters dialog, Tab trapped, Escape closes, focus returns to trigger; reveal focuses the card title | ☐ |
| Decision-boundary dialog: initial focus on "返回修改", Escape refocuses the question textarea | ☐ |
| Ritual: only top deck card focusable; positions expose `aria-current="step"`; plaque count announced via `aria-live` | ☐ |
| DOM order matches visual order on desktop and after mobile collapse | ☐ |
| Touch targets ≥44px on Paper pages | ☐ |

## 5. Motion & reduced motion

| Check | Pass |
| --- | --- |
| Full choreography: home section entrances, quick-draw flip (800ms), ritual intro/shuffle/draw (frozen timings), reveal/reading staggers — ceremonial, no bounce | ☐ |
| With `prefers-reduced-motion: reduce`: CSS durations collapse AND JS behavior switches (instant scroll, skipped intro, 350ms shuffle, 200ms draw, no smooth scrolling) | ☐ |
| Paper-burn only on capable desktop digital draws; reduced-motion/mobile/offline paths navigate directly | ☐ |
| No constant ambient motion competing with reading content | ☐ |

## 6. Design-language spot checks

| Check | Pass |
| --- | --- |
| Correct surface per route; no midnight panel styling in reading documents, no paper cards on the ritual stage | ☐ |
| Terracotta = actions/emphasis/major; indigo = progress/current/focus/reversed; never equal-intensity in one component; `*-ink` variants for text | ☐ |
| Mono kicker labels (uppercase, wide tracking) for indices only; serif for narrative; sans for chrome | ☐ |
| No new cards/pills/glass/neon; hierarchy built with hairlines, measure, and whitespace | ☐ |
