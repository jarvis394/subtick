# subtick

subtick turns a group's CS2 matches into highlight clips with no manual work. It picks up new matches from each player's Steam match history, parses the demos for moments worth watching, and renders those moments into video clips inside CS2 itself. It is self-hosted, for a group of friends; [docs/PRODUCT.md](docs/PRODUCT.md) has the product in full.

## How it fits together

A bun and TypeScript monorepo (bun workspaces, turbo).

| app / package                      | what                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/web`                         | the web app: React, TanStack Router, Tailwind, built with Vite                          |
| `apps/api`                         | HTTP api (Elysia) under `/api`, sign-in (better-auth), and the endpoints recorders use  |
| `apps/steam`                       | worker: syncs match history, resolves matches through a Steam bot, downloads demos      |
| `apps/parser`                      | worker: parses demos into stats, a round timeline and highlights                        |
| `apps/recorder`                    | worker: records highlights in CS2 with HLAE, on Windows or in Docker with an NVIDIA GPU |
| `packages/db`                      | Postgres schema and migrations (Drizzle)                                                |
| `packages/queue`                   | the BullMQ queues on Redis and the match events browsers subscribe to                   |
| `packages/storage`                 | S3 buckets (`demos`, `clips`) and presigned URLs                                        |
| `packages/config`                  | environment validation, shared by every app                                             |
| `packages/domain`                  | types and pure logic shared by the apps                                                 |
| `packages/steam`                   | the Steam Web API client                                                                |
| `packages/logger`, `packages/mail` | logging; email-confirmation mail (Resend, or the log locally)                           |
| `packages/oxlint-plugin-subtick`   | the repo's own lint rules                                                               |

A match goes through them in order: the steam worker finds a new share code with the Steam Web API, asks the Game Coordinator (through the bot account) for the demo URL, and stores the demo in the `demos` bucket; the parser analyzes it into Postgres and queues its highlights; a recorder renders them and uploads the clips to the `clips` bucket through the api; the web app shows each step as it happens. Redis carries the jobs between them.

## Prerequisites

- [bun](https://bun.sh) 1.4.4 (the version in `package.json`'s `packageManager`): `curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.4"`
- [Docker](https://docs.docker.com/get-docker/) with Compose v2, for Postgres, Redis and SeaweedFS (S3)
- `bzip2`, only for `bun run seed` and for the steam worker's demo downloads

No Steam account, API key or GPU is needed to work on the web app, the api or the parser.

## Quickstart

```sh
git clone https://github.com/jarvis394/subtick.git && cd subtick
bun run setup
bun run dev
```

`bun run setup` checks bun and Docker, installs dependencies, creates `.env` from [`.env.example`](.env.example) with generated secrets, starts the infra ([`infra/compose.yml`](infra/compose.yml)), waits for it and runs the migrations. It is safe to rerun and never changes a value already in `.env`.

`bun run dev` starts the api, the web app and the parser and steam workers, restarting on changes. Open <http://localhost:5173>, sign up with any email (nothing is sent locally) and skip the Steam step. Then get some data in (below).

## Data in a dev instance

- **Sample demos**: `bun run seed` downloads three real match demos (about 420 MB, into `apps/parser/test/fixtures`), parses them and adds them to every user, as the best player of each match. Sign up first; run it again for users added later. Valve deletes old demos from its servers, so the downloads stop working some day; `bun run --filter @subtick/parser seed <demo.dem>...` seeds any demo whose file name starts with its match id.
- **Through the pipeline**: with `bun run dev` running, `bun run --filter @subtick/steam-worker enqueue <demo URL>` runs a Valve replay URL (`http://replay<n>.valve.net/730/<matchId>_<x>.dem.bz2`) through the real download and parse jobs, without a Steam account. The match belongs to no one unless `--user <steamId64>` names a linked Steam account.
- **Dev menu**: a dev build of the web app, served from localhost, has a button in the corner with fake matches (a refresh "finds" them; needs a linked Steam account) and fake highlights on the open match: failed, recording, ready, or a simulated recorder run.
- **Real matches**: set `STEAM_API_KEY` ([get one](https://steamcommunity.com/dev/apikey)) and link Steam in the web app with your match history's authentication code. Downloading the demos of new matches needs a Steam bot account (`STEAM_BOT_*` in `.env`); use a dedicated account, not your own.
- **Clips**: a recorder, set up as in [apps/recorder/README.md](apps/recorder/README.md) and pointed at your dev instance.

`bun run --filter @subtick/api grant-admin <email>` makes a user an admin, which opens **Manage instance** (users, storage, recorders) in the account menu.

## Configuration

Everything except the recorder reads the repo-root `.env`; [`.env.example`](.env.example) lists every variable with a comment. The defaults match `infra/compose.yml`. If a port is taken, change `POSTGRES_PORT`, `REDIS_PORT`, `S3_PORT` or `API_PORT` and the URLs that use them. Without `STEAM_API_KEY`, everything that calls the Steam Web API (Steam sign-in, player profiles, match-history sync) fails when used, with `STEAM_API_KEY is not set` in the logs, and the rest works. Production (`NODE_ENV=production`, set by the server image) refuses to start without it.

## Commands

| command                              | what                                                      |
| ------------------------------------ | --------------------------------------------------------- |
| `bun run setup`                      | prepares a checkout (above)                               |
| `bun run dev`                        | api, web app, parser and steam workers in watch mode      |
| `bun run dev:web`, `bun run dev:api` | one of them                                               |
| `bun run infra:up`, `infra:down`     | starts or stops Postgres, Redis and SeaweedFS             |
| `bun run db:generate`                | writes a migration after a schema change in `packages/db` |
| `bun run db:migrate`                 | applies migrations                                        |
| `bun run seed`                       | sample demos (above)                                      |
| `bun run build`                      | builds the web app                                        |
| `bun run fmt`, `fmt:check`           | formats with oxfmt, or checks it                          |
| `bun run lint`                       | oxlint with the repo's rules                              |
| `bun run typecheck`                  | TypeScript in every package                               |
| `bun run test`                       | tests (bun test)                                          |

The parser's demo tests are skipped until `bun run --filter @subtick/parser fixtures` has downloaded the demos. `bun run --filter @subtick/parser inspect <demo.dem>` prints a demo's scoreboard and highlights. `bun run --filter @subtick/db studio` opens Drizzle Studio on the dev database. The map images, rank and killfeed icons are committed; `apps/web/scripts/fetch-*.ts` download them again from their sources. CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `fmt:check`, `lint`, `typecheck` and `test`.

## More

- [apps/recorder/README.md](apps/recorder/README.md): installing, configuring and updating recorders.
- [infra/deploy/](infra/deploy): the production stack, a Compose file for Dokploy behind Traefik; its header and `.env.example` describe it.
- [docs/PRODUCT.md](docs/PRODUCT.md) and [docs/DESIGN.md](docs/DESIGN.md): product and visual design; [docs/internal/web.md](docs/internal/web.md): conventions for the web app's UI code.
- [CLAUDE.md](CLAUDE.md): code taste for the repo.
