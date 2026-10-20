# Conventions

- Format (oxfmt): no semicolons, single quotes, trailing commas, printWidth 100.
- Lint (oxlint): `typescript/no-explicit-any` error, `consistent-type-imports` error, `import/no-cycle` error, side-effect imports only for `*.css`. `no-console` is off.
- Comments explain why only (constraint, external quirk, invariant); no restating names, narration, or history.
- Prefer inferred types over annotations; never `any`.
- Files under 500 lines; split into focused modules/folders.
- Generated/ignored: `routeTree.gen.ts`, `drizzle/`, `test/fixtures/`, `dist/`; never hand-edit.
- Domain logic stays pure in `packages/domain`; IDs that exceed JS number precision (Valve matchId) are decimal strings.
- Read large files by grep + offset/limit rather than whole (project CLAUDE.md).
