# Commands (run from repo root; use bun, not npm/pnpm)

- `bun install`
- `bun run infra:up` / `infra:down`: postgres, redis, seaweedfs via `infra/compose.yml` (host ports overridable via POSTGRES_PORT/REDIS_PORT/S3_PORT in `.env`)
- `bun run db:generate` / `db:migrate` (filters `@subtick/db`)
- `bun run dev` (turbo, all apps) or per app: `bun run --filter @subtick/api dev`, `... web dev` (vite)
- `bun run typecheck`, `bun run test` (only `apps/parser` has tests: `bun test`), `bun run lint`, `bun run fmt` / `fmt:check`
- App scripts: parser `fixtures|inspect|seed`; steam/recorder `enqueue`; api `grant-admin`; web `scripts/fetch-*-icons|assets.ts`
- Gotchas: root `.env` is not auto-loaded from `apps/*`; another Redis may already hold 6379 locally (see user memory notes on local queue).
- Darwin: nothing special beyond BSD `sed -i ''` and `ls`/`grep` flag differences.
