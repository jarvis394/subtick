# Dev tools (local only)

Floating flask button, bottom-right: `apps/web/src/components/dev-menu/` (`index.tsx` shell, one file per tab). Fake data for working on UI states without a steam worker or recorder.

## Gating (keep it this way)
- Web: `app-shell` imports `DevMenu` only when `import.meta.env.DEV`; each tab is `React.lazy` inside it. Never import dev code from regular components.
- Api: `routes/dev.ts` is always mounted (Eden types need it) but every handler returns 404 unless `devToolsEnabled(env)` (`services/dev-flag.ts`: `PUBLIC_URL` hostname is localhost). Services (`dev-matches.ts`, `dev-highlights.ts`) are `import()`ed inside handlers, and by `queue.ts`/`sync-now.ts` only after the flag check. A non-dev process never loads them.
- Anything new for dev tools follows the same pair: flag check first, dynamic import after.

## What each tab does
- Matches: stages fake matches in memory (`pending` map); the next "Check for new" materializes them as ready matches (`serverName = 'subtick dev'`).
- Highlights: adds fakes to the open match (or the last one opened, tracked in `DevMenu`). Rows are real `highlight` rows titled `[dev] ...` (that prefix is the only marker: list/delete touch nothing else). States: failed (error text), recording (status `queued`), ready (`recorded` + a `clip` row borrowing the video keys of any stored clip, so one clip must exist), and `simulate`.
- `simulate`: 10 s run. Publishes `MatchEvent`s on `ctx.publish` each second (loading, recording % , rendering) and registers an entry in `simulatedJobs`, which `queue.ts` `readJobs` lists as an active recording job so the Queue page shows it; then flips the row to `recorded` and inserts the borrowed clip. Deleting the fake mid-run stops it.

## Gotchas
- Fakes are two-kill `double` moments on purpose: `notOneKill` hides one-kill highlights from match pages.
- Fakes must be deleted from the menu (or `DELETE /api/dev/highlights/:id`); they persist in the dev DB.
- Invalidate `['dev', 'highlights']`, `['match', id]`, `['highlights']`, `['queue']` after mutations so pages refetch.
