# AetherTarot Agent

AetherTarot is a reflective tarot reading agent built around structured output, safety boundaries, and a Next.js reading experience.

The product goal is not deterministic fortune telling. It uses tarot language as a narrative and reflective interface: questions are interpreted through spread positions, card evidence, synthesis, and gentle next-step prompts.

## Online Experience

Production beta is available at [https://aethertarot.cn/](https://aethertarot.cn/).

Guest and tester quotas are enforced at runtime. Logged-in beta users are managed through the invite-only Credentials flow.

## What Is In This Repository

- `apps/web`: the active Next.js app, including reading flow, encyclopedia, history, login, admin, and API routes.
- `packages/domain-tarot`: runtime tarot deck and spread access.
- `packages/prompting`: prompt and provider assembly for structured readings.
- `packages/shared-types`: shared reading, history, card, and spread contracts.
- `knowledge`: governed runtime tarot knowledge used by encyclopedia and retrieval paths.
- `data`: card and spread source data consumed by the app.
- `scripts`: repository maintenance and asset validation utilities.
- `.agents/skills`: public repo-local agent skills that are safe to share.

Local planning notes, operational work logs, generated reports, scratch files, private deployment instructions, and long-form internal docs are intentionally excluded from the public repository.

## Runtime Capabilities

The current app supports:

- single-card, holy triangle, four-aspects, seven-card, and Celtic cross spreads
- structured reading output through `/api/reading`
- safety hard stops and sober-check responses for high-risk or decision-outsourcing cases
- quick reading and full ritual reading paths
- local history replay plus account-level completed reading storage
- encyclopedia browsing backed by `knowledge/wiki`
- optional OpenAI-compatible LLM providers behind server-side environment variables
- invite-only beta access, quota tracking, telemetry, and lightweight feedback

The current app does not include:

- public self-registration
- Supabase Auth magic-link login
- long-term user profiling or memory merge
- thread/session checkpoint persistence
- payment, subscription, or public account management

## App Architecture

```text
AetherTarot/
├─ apps/
│  └─ web/
├─ packages/
│  ├─ domain-tarot/
│  ├─ prompting/
│  └─ shared-types/
├─ data/
├─ knowledge/
├─ scripts/
├─ prototype/
├─ external/
├─ .agents/
│  └─ skills/
├─ .github/
├─ AGENTS.md
├─ DESIGN.md
└─ README.md
```

The active runtime lives in `apps/web`. The route surface includes:

- `/`: entry and returning-user journey
- `/new`: question and spread selection
- `/ritual`: shuffle and draw interaction
- `/reveal`: card reveal
- `/reading`: structured reading result
- `/history`: completed reading replay
- `/encyclopedia`: tarot knowledge browser
- `/login`: invite-only Credentials login
- `/admin`: beta operations dashboard for admin users

## Development

Use the workspace package scripts from the repository root:

```powershell
npm ci
npm run test:contract -w @aethertarot/web
npm run lint -w @aethertarot/web
npm run build -w @aethertarot/web
```

For end-to-end checks:

```powershell
npm run test:e2e -w @aethertarot/web
```

## Public Repository Hygiene

Do not commit secrets, environment files, test account credentials, private deployment details, generated reports, scratch experiments, or local work logs.

The public repository keeps product/runtime code and governed runtime knowledge. Private project notes and operator procedures should stay local.

## Disclaimer

AetherTarot is for AI product exploration and reflective entertainment. Tarot readings do not replace medical, legal, financial, psychological, or other professional advice.
