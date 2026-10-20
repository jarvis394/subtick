# Tech stack

- Runtime/PM: bun 1.3.x (`packageManager` pinned), ESM (`"type": "module"`), TypeScript 7 (`tsc --noEmit`, no emit build for services).
- Monorepo: Turborepo (`turbo.json`: build/typecheck/test/dev).
- API: Elysia + better-auth (Steam stored as `account` row, providerId `steam`), Eden Treaty typed client.
- DB: Postgres + Drizzle (migrations in `packages/db/drizzle`, drizzle-zod).
- Queue: BullMQ on Redis. Storage: S3 API via `Bun.S3Client` against SeaweedFS.
- Web: Vite, React, @base-ui/react, Tailwind v4, TanStack Router + Query, Sonner toasts, motion for animation.
- Parser: `@laihoe/demoparser2`. Recorder: CS2 + wine-staging + ffmpeg on a GPU host.
- Lint/format: oxlint, oxfmt (not eslint/prettier).
- tsconfig base (`packages/tsconfig/base.json`): strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `moduleResolution: bundler`.
