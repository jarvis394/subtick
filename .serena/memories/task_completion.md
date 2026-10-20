# Task completion

Run from repo root, in order:

1. `bun run fmt` (or `fmt:check`)
2. `bun run lint`
3. `bun run typecheck`
4. `bun run test` if parser/domain logic touched (`apps/parser` only)
5. After schema changes: `bun run db:generate` and commit the migration.
   Do not verify via browser/computer use unless the user agrees. Commit only when asked.
