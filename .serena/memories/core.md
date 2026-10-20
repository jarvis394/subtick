# subtick core

Self-hosted CS2 highlights app: Steam share codes -> demo download -> parse -> highlight candidates -> recorded clips. Bun + Turborepo monorepo (`apps/*`, `packages/*`).

- Full design, pipeline diagram, data model, queue list: `ARCHITECTURE.md` (repo root). Some details are aspirational (e.g. `packages/ui` doesn't exist; UI lives in `apps/web/src/components/ui`).
- Stack, versions: `mem:tech_stack`
- Dev/infra/db commands: `mem:suggested_commands`
- Style rules (lint, format, comments, types): `mem:conventions`
- What to run before declaring done: `mem:task_completion`
- Local-only dev menu (fake matches/highlights, simulated recording), its gating and how fakes are marked: `mem:dev_tools`

## Source map

- `apps/api` Elysia gateway: better-auth, REST, SSE, presigned S3 URLs (`src/routes`, `src/services`, `src/auth`)
- `apps/web` Vite + React + base-ui + Tailwind v4 + TanStack Router/Query, Eden Treaty client (`src/routes` file-based, `routeTree.gen.ts` generated)
- `apps/steam` worker: scheduler, sync-user, resolve-match (Steam GC bot), demo download
- `apps/parser` worker: demo.parse via demoparser2; only app with tests (`test/`, fixtures)
- `apps/recorder` worker: clip.record/reel on GPU host (CS2 under wine + ffmpeg); own Dockerfile/README
- `packages/`: `db` (drizzle schema+migrations), `queue` (typed queue registry/job IDs), `storage` (S3 port), `mail`, `domain` (pure logic, no I/O), `logger` (tslog), `config` (zod env per app), `steam`, `tsconfig`

## Invariants

- Every pipeline stage is a BullMQ queue, idempotent, keyed by stable ID (match id = Valve matchId as decimal text).
- `domain` has no I/O. Workers depend on ports (`storage`, `queue`, recorder interface), otherwise call Drizzle/Elysia directly; no repository layer.
- Env is validated per app in `packages/config`; root `.env` (template `.env.example`) is shared.
- Workspace deps use `workspace:*` and `@subtick/<name>` names (steam worker is `@subtick/steam-worker`).
