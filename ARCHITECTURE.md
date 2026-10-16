# subtick — architecture plan

A self-hosted CS2 highlights app (Allstar-like first, Leetify-like second).
Users sign in, link Steam, paste their match-history auth code, and subtick
finds their new Premier/Competitive matches on its own, parses each demo, picks the best moments, and records them as video clips.

Not commercial. No landing page, no billing.

---

## 1. Pipeline at a glance

```
            ┌──────────────┐  repeatable   ┌────────────────────┐
            │  scheduler   │──────────────▶│ steam.sync-user    │  (Steam Web API: next share code)
            └──────────────┘   (batched)   └─────────┬──────────┘
                                                     │ new share codes
                                                     ▼
                                           ┌────────────────────┐
  user pastes share code ─────────────────▶│ steam.resolve-match│  (Steam GC via bot account → demo URL)
                                           └─────────┬──────────┘
                                                     │ upsert matches(id) — dedup point #1
                                                     ▼
                                           ┌────────────────────┐
                                           │ demo.download      │  jobId = matchId — dedup point #2
                                           └─────────┬──────────┘  .dem.bz2 → .dem.zst in S3
                                                     ▼
                                           ┌────────────────────┐
                                           │ demo.parse         │  demoparser2 → stats + highlight candidates
                                           └─────────┬──────────┘
                                                     ▼
                                           ┌────────────────────┐
                                           │ clip.record        │  one job per (match) batch of clips, GPU worker
                                           └─────────┬──────────┘  CS2 + ffmpeg → mp4 + thumb in S3
                                                     ▼
                                           ┌────────────────────┐
                                           │ clip.reel (opt.)   │  ffmpeg concat → per-user match reel
                                           └────────────────────┘

   api (Elysia gateway) ── reads Postgres, signs S3 URLs, streams job progress over SSE
   web (React)          ── Eden Treaty client, fully typed end-to-end
```

Every arrow is a queue. Every stage is idempotent and keyed by a stable ID,
so retries and duplicate submissions are harmless.

---

## 2. Monorepo layout (bun + turborepo)

```
subtick/
├─ apps/
│  ├─ api/            Elysia gateway: better-auth, REST, SSE, signed URLs
│  ├─ web/            Vite + React + base-ui + Tailwind v4 + TanStack Router/Query
│  ├─ steam/          worker: scheduler, sync-user, resolve-match, download ("match downloader")
│  ├─ parser/         worker: demo.parse (demoparser2) + tests/fixtures
│  └─ recorder/       worker: clip.record, clip.reel (runs on the GPU host)
├─ packages/
│  ├─ db/             drizzle schema, client, migrations, drizzle-zod schemas
│  ├─ queue/          typed queue registry (names, payloads, job IDs, default opts)
│  ├─ storage/        object storage port + Bun.S3Client adapter (SeaweedFS S3)
│  ├─ domain/         pure types and logic: share-code codec, highlight kinds, tick↔time
│  ├─ logger/         tslog, one named sub-logger per service; pretty in dev, JSON in prod
│  ├─ config/         env schema per app (zod + dotenv), fail fast on boot
│  ├─ ui/             base-ui components with subtick defaults (button, dialog, menu…)
│  └─ tsconfig/       shared tsconfig bases
├─ infra/
│  └─ compose.yml     postgres, redis, seaweedfs (+ recorder image on the GPU box)
├─ turbo.json  package.json  .oxlintrc.json  .oxfmtrc.json
```

Rules that keep it lean:

- **`domain` has no I/O.** Pure functions that are easy to test (share-code decode, highlight scoring, round timelines).
- **Workers depend on ports, not vendors.** `storage`, `queue`, and the recorder's `Recorder` interface are the only abstractions. Everything else calls Drizzle or Elysia directly. No repository-per-table layer.
- **One process per app, horizontally scalable.** Only `recorder` is stateful, because it holds a running CS2 instance.
- Tooling: `oxlint` and `oxfmt` at the root, `tsc --noEmit` per package through turbo, and `bun test` in `apps/parser` only.

---

## 3. Data model (Postgres + Drizzle)

better-auth owns `user`, `session`, `account`, `verification`. Steam is stored as an `account` row with `providerId = "steam"` and `accountId = steamId64`.

| table          | key columns                                                                                                                                                                                                                | notes                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `steam_link`   | `userId`, `steamId64` (unique), `authCode` (encrypted), `lastShareCode`, `syncState`, `nextSyncAt`, `lastError`                                                                                                            | One per linked Steam account. Created when the user enters the match auth code.                                      |
| `match`        | `id` (Valve matchId from share code as decimal text, PK, so it survives JSON), `shareCode`, `demoUrl`, `status`, `map`, `startedAt`, `durationTicks`, `tickrate`, `scoreCt/T`, `demoKey`, `demoExpiresAt`, `parserVersion` | **Global, deduped.** `status`: `queued → resolving → downloading → parsing → recording → ready \| failed \| expired` |
| `match_player` | `(matchId, steamId64)` PK, `team`, `name`, plus a stats JSONB or columns (K/D/A, ADR, HS%, KAST, entries, clutches, util dmg, flash assists, rating)                                                                       | Leetify-lite stats. Written by the parser.                                                                           |
| `user_match`   | `(userId, matchId)` PK, `steamId64`, `discoveredAt`                                                                                                                                                                        | Links users to shared matches. Many users point at one match.                                                        |
| `round`        | `(matchId, n)`, `winner`, `reason`, `startTick`, `endTick`, `ctEquip`, `tEquip`                                                                                                                                            | Used for timelines and clutch detection.                                                                             |
| `kill`         | `id`, `matchId`, `round`, `tick`, `attacker`, `victim`, `assister`, `weapon`, `flags` (bitmask), `distance`                                                                                                                | Enriched `player_death`. Feeds both stats and highlights.                                                            |
| `highlight`    | `id`, `matchId`, `steamId64`, `kind`, `score`, `startTick`, `endTick`, `round`, `meta` JSONB, `status`                                                                                                                     | A candidate moment. `status`: `candidate → queued → recorded \| skipped \| failed`                                   |
| `clip`         | `id`, `highlightId`, `videoKey`, `thumbKey`, `durationMs`, `width/height`, `recorderVersion`                                                                                                                               | The rendered artifact.                                                                                               |
| `reel`         | `id`, `matchId`, `steamId64`, `videoKey`, `clipIds[]`                                                                                                                                                                      | Optional per-player montage.                                                                                         |

Highlights and clips belong to **(match, player)**, not to a user. If two friends played the same match, both see each other's clips for free, and each moment is recorded once.

---

## 4. Services in detail

### 4.1 `steam`: match discovery and download

**What the user provides.** Their _game authentication code_ (`XXXX-XXXXX-XXXX`, from Steam Help → "Access to Your Match History") and _their most recent match share code_ (`CSGO-xxxxx-…`). Valve's API requires both.

**`steam.sync-user`** (`jobId = steamId64:<bucket>`)

- Calls `ICSGOPlayers_730/GetNextMatchSharingCode/v1?key&steamid&steamidkey&knowncode` in a loop until it returns `n/a`.
- Each new code → `steam.resolve-match`. Advances `lastShareCode` transactionally.
- `202 n/a` means caught up: set `nextSyncAt = now + 15m` (backoff to 1h for inactive users).
- `412` means the auth code is invalid: set `syncState = needs_auth` and surface it in the UI.

**Scheduler** (a BullMQ repeatable job, every minute)

- `SELECT … WHERE nextSyncAt <= now() LIMIT 200 FOR UPDATE SKIP LOCKED` and enqueue a batch with `addBulk`.
- A queue limiter caps the Web API rate (for example 5 req/s).

**`steam.resolve-match`** (`jobId = matchId`)

- Decodes the share code in `domain` (base57) into `{ matchId, outcomeId, token }`.
- `INSERT … ON CONFLICT DO NOTHING` into `match`, and always upserts `user_match`. **If the match already has a demo or is in progress, stop here.** That is the "don't redownload" guarantee.
- Otherwise it asks the **Steam Game Coordinator** for the demo URL. This needs a logged-in Steam _bot account_, using `steam-user` + `globaloffensive` and `requestGame(shareCode)`. The URL is in the last `roundstatsall[].map`.
- The GC session is a long-lived singleton, so the queue runs with concurrency 1 and a limiter of about 1 req/s. More throughput comes from more bot accounts, not more concurrency.

**`demo.download`** (`jobId = matchId`)

- Streams `replayNNN.valve.net/…dem.bz2`, decompresses it (bz2 streaming), recompresses with zstd, and uploads to `demos/<matchId>.dem.zst`.
- A `404` means Valve expired the demo (about 30 days), so `status = expired`.
- Then enqueues `demo.parse`.

**Dev entry point.** `bun run --filter steam enqueue <demo-url | share-code>`. This is how the three test demos enter the pipeline without a Steam account.

### 4.2 `parser`: stats and highlight detection (the core)

Pulls the demo to local scratch, decompresses it, and runs `@laihoe/demoparser2`:

| call                                | what we take                                                                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseHeader`                       | map, server, tickrate                                                                                                                                                        |
| `parseEvents([...])`                | `player_death`, `round_start`, `round_end`, `round_freeze_end`, `bomb_planted`, `bomb_defused`, `bomb_exploded`, `player_hurt`, `player_blind`, `weapon_fire`, `player_jump` |
| `parsePlayerInfo`                   | steamids, names, teams                                                                                                                                                       |
| `parseTicks(props, ticks, players)` | **targeted only.** `X Y Z pitch yaw velocity is_alive health` over ±2s windows around candidate moments, for flick, airborne, and movement checks. Never the full demo.      |
| `parseGrenades`                     | utility damage, grenade-kill attribution                                                                                                                                     |

It is built as a pipeline of pure functions in `apps/parser/src/` (no I/O except the edges):

```
load → normalize (events → typed Round/Kill/Damage timelines)
     → stats(timelines)                  → match_player rows
     → detectors[](timelines, ticks)     → HighlightCandidate[]
     → merge + score + select            → highlight rows (top N per player)
     → plan clips                        → clip.record job (batched per match)
```

#### Highlight detectors

Each detector is a small module: `(ctx) => Candidate[]`. Most flags come straight from `player_death` (`headshot`, `penetrated`, `noscope`, `thrusmoke`, `attackerblind`, `attackerinair`, `assistedflash`, `distance`). The rest are derived.

| kind                                                    | detection                                                                                                                 | base score              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `ace`                                                   | 5 kills by one player in one round                                                                                        | 100                     |
| `quad` / `triple` / `double`                            | ≥N kills in a round **within a sliding window** (fast multikills score higher than spread-out ones)                       | 70 / 45 / 15            |
| `clutch_1vN`                                            | Alive-count timeline: the player is last alive vs N, and the team wins. The clip covers from the 1vN moment to round end. | 30 + 20·N               |
| `entry_multi`                                           | The opening kill of the round, followed by another kill within 3s                                                         | 25                      |
| `wallbang` / `smoke` / `noscope` / `blind` / `airborne` | event flags                                                                                                               | +15 to +30 modifiers    |
| `flick`                                                 | Max yaw/pitch angular velocity in the 150 ms before the kill is above a threshold. Taken from targeted `parseTicks`.      | +20                     |
| `collateral`                                            | ≥2 victims, same attacker, same tick, same weapon                                                                         | 40                      |
| `long_shot`                                             | AWP/SSG/Deagle kill with `distance` above a threshold                                                                     | +15                     |
| `special_weapon`                                        | knife, zeus, grenade kill                                                                                                 | 35                      |
| `defuse_clutch`                                         | Defuse with <1s left, or a defuse while enemies are alive                                                                 | 40                      |
| `eco_frag`                                              | Pistol or SMG multikill vs full-buy enemies (from round equip values)                                                     | +20                     |
| `low_hp`                                                | Multikill at ≤10 HP                                                                                                       | +15                     |
| `fail` (optional reel)                                  | team kill, self-flash death, death to the bomb                                                                            | separate "fails" bucket |

Scoring is `score = base + Σ modifiers · round_importance`. Round importance boosts match point, overtime, pistol rounds, and close scorelines.

**Merging into clips.** Candidates for the same player whose windows overlap (kills <6s apart) collapse into one highlight. The richest kind wins and the modifiers are combined. Window = `[firstEvent − 4s, lastEvent + 2.5s]`, clamped to `[round_freeze_end, round_end + 1s]`, max 40s (clutches use their own window).

**Selection.** Top 5 per player, then everyone above a score threshold. By default only **subtick users'** players are recorded immediately. Other players' highlights stay `candidate` and are recorded lazily if someone requests them. This keeps GPU time bounded.

All thresholds live in one `highlightConfig` object, versioned by `parserVersion`. Bumping the version allows re-parsing old demos while they still exist.

**Tests** (`apps/parser/test/`)

- `bun test`. `scripts/fetch-fixtures.ts` downloads the three test demos into `test/fixtures/` (gitignored).
- Unit tests for detectors run on hand-built timelines, so they are fast and need no demo.
- Snapshot tests run the full pipeline on each fixture: scoreboard totals, round count, and the highlight list.
- Invariant tests: K/D sums match, and every clip window sits inside its round.

### 4.3 `recorder`: headless CS2 capture

This is the hardest piece and the reason the `Recorder` port exists:

```ts
interface Recorder {
  prepare(match: { demoPath: string; map: string }): Promise<void>
  record(clip: ClipPlan): Promise<RecordedFile> // mp4 on local disk
  dispose(): Promise<void>
}
```

**Primary adapter: `Cs2Recorder`** (Linux GPU host, Docker)

- CS2 runs inside **gamescope `--backend headless`** (no physical display) on an NVIDIA/AMD GPU. Launch options: `-insecure -novid -nojoy -console -netconport 2121 -w 1920 -h 1080 +exec subtick.cfg`. The Steam client runs logged in as the same bot account (CS2 is free).
- **Control** goes through the netcon TCP console: `playdemo`, `demo_gototick <t>`, `spec_player_by_accountid <id>`, `demo_timescale`, `demo_pause/resume`. Readiness is detected by tailing console output. Game State Integration is an optional second signal.
- **`subtick.cfg`** gives a clean look: `cl_draw_only_deathnotices 1`, a hidden demo UI, `voice_enable 0`, no x-ray, a fixed viewmodel/FOV, `cl_hud_color`, and so on. This is the visual identity of every clip.
- **Capture** uses ffmpeg from the gamescope PipeWire stream plus the audio sink. NVENC H.264 1080p60, about 12 Mbps.
- **Batching is the key optimization.** One `clip.record` job is one match: load the demo once (10–20s), then for each clip seek to `startTick − 2s` (settle), set POV, unpause, and capture `(end − start) / tickrate` seconds. The trim to exact boundaries happens after capture.
- **Post:** `ffmpeg` trims, writes a thumbnail from the peak-kill frame, then the files are uploaded to `clips/<highlightId>.mp4` and the `clip` rows inserted.
- The worker has concurrency 1 per GPU and keeps CS2 warm between jobs. A watchdog restarts CS2 if netcon goes silent, and a per-clip timeout marks the clip `failed` without failing the whole batch.
- Queue priority: freshly discovered matches > lazy requests > re-renders.

**Fallback adapter: `RadarRecorder`** (no GPU, also useful in dev)

- The parser already has positions. The parser can emit a compact tick track for each highlight window (positions, view angles, kills, grenades at 16 Hz, about 30 KB).
- The web app renders it as an animated 2D radar replay (canvas). No video file is needed.
- This makes highlights visible immediately while the GPU render is queued, and lets you develop the whole product without CS2.

**`clip.reel`** (optional) concatenates a player's top clips into one match reel with ffmpeg `concat` and short crossfades.

### 4.4 `api`: Elysia gateway

- **better-auth** is mounted with `.mount(auth.handler)`, using email/password and the Drizzle adapter.
- **Steam** uses OpenID 2.0, which better-auth has no built-in provider for (an upstream plugin is proposed in better-auth/better-auth#4877, not merged), so subtick ships a small **better-auth plugin** (`steam()`) with the same paths:
  - `POST /api/auth/sign-in/steam` and `POST /api/auth/link-social/steam` return the `steamcommunity.com/openid` URL. Flow state is stored server-side and single-use.
  - `GET /api/auth/steam/callback` verifies with `check_authentication`, extracts steamId64, fetches the persona via `GetPlayerSummaries`, then either links an `account` row to the current user or signs in or creates a user.
- Routes are grouped in Elysia plugins, each with a zod schema (Elysia accepts Standard Schema), so **Eden Treaty** gives the web app full types:
  - `GET /me`: user and linked Steam accounts with sync state.
  - `PUT /steam-links/:steamId/match-auth`: auth code + last share code, validated against Valve before saving (AES-GCM encrypted at rest). `DELETE /steam-links/:steamId` unlinks, unless it is the last sign-in method.
  - `POST /matches/import`: manual share code.
  - `GET /matches`, `GET /matches/:id`: header, rounds, scoreboard, highlights with signed clip URLs.
  - `GET /highlights?cursor&recordedOnly`: the user's highlight feed.
  - `POST /highlights/:id/record`: lazy render request.
  - `GET /events`: **SSE**. Workers publish `{ matchId, status, progress }` to Redis pub/sub, and the api fans it out to subscribed users.
- Clip and demo URLs are short-lived presigned S3 URLs. The api never proxies video bytes.

### 4.5 `web`: React

- **Stack:** Vite, React 19, TanStack Router (file routes), TanStack Query + Eden Treaty, base-ui primitives, Tailwind v4, `packages/ui` for components.
- **Routes:**
  - `/login`: email/password + "Continue with Steam".
  - `/setup`: link Steam → paste auth code + latest share code, with inline help on where to find them.
  - `/` (feed): your newest highlights as big autoplay-on-hover cards, then a list of recent matches with live pipeline status.
  - `/matches/$id`: **highlights first.** A clip player strip ordered by score, then a round timeline with kill markers (click to jump to the clip), then the scoreboard below.
  - `/clips/$id`: a single clip page.
  - `/settings`: Steam links, auth code, re-sync, delete account.
- **Design language:** "quiet". Warm neutral palette, one accent, generous spacing, system/Inter type, no gradients or glass. A few ui defaults differ from shadcn's:
  - `Button` always has `cursor: pointer`, and has **two layers**:
    ```tsx
    <button className="group relative isolate …">
      <span
        aria-hidden
        className="absolute inset-0 -z-10 rounded-[inherit] bg-… transition-transform
                                   duration-150 ease-out group-active:scale-[0.97]"
      />
      <span className="relative">{children}</span>
    </button>
    ```
    Only the background scales on `:active`, so the label stays crisp. It uses `transform` only (compositor-friendly) and respects `prefers-reduced-motion`.
  - Focus rings appear only on `:focus-visible`, hover states are wrapped in `@media (hover: hover)`, and `user-select: none` is set on controls.
  - There is light and dark mode via CSS tokens on `:root`. Dark is the default, because this is a gaming app.

---

## 5. Queues and infrastructure

- **BullMQ 6 on Redis**, connected through Bun's native `RedisClient` (no ioredis). It gives `jobId` dedup, flows, per-queue rate limiters, priorities, repeatable jobs, and Redis pub/sub for SSE in one dependency. `packages/queue` exports a typed registry:
  ```ts
  export const queues = {
    'steam.sync-user':     q<{ steamId64: string }>({ attempts: 5, backoff: exp(30s) }),
    'steam.resolve-match': q<{ shareCode: string; userId?: string }>({ limiter: { max: 1, duration: 1000 } }),
    'demo.download':       q<{ matchId: string }>({ attempts: 3 }),
    'demo.parse':          q<{ matchId: string }>({ attempts: 2 }),
    'clip.record':         q<{ matchId: string; highlightIds: string[] }>({ attempts: 2 }),
    'clip.reel':           q<{ matchId: string; steamId64: string }>({}),
  } as const
  ```
  Job IDs are derived from domain keys (`matchId`, `highlightId`), so a duplicate enqueue is a no-op.
- **Postgres 17** (Drizzle over Bun's native `bun:sql` driver) is the source of truth for state. Queue jobs carry only IDs, and workers load state from the DB. A failed or retried job can never act on stale payload data.
- **Object storage** goes through `Bun.S3Client` against **SeaweedFS** and its S3 gateway (`weed server -s3`, master + volume + filer + S3 in one container), in dev and self-hosted prod. Buckets: `demos`, `clips`. Retention: a filer path TTL (`fs.configure -locationPrefix=/buckets/demos -ttl=30d`) instead of S3 lifecycle rules. `clips` has no TTL. Because the code only sees the storage port, any S3-compatible store can replace it.
- **Observability:** structured logs via tslog (`LOG_FORMAT=json` in prod), fields-first, with `matchId` / `jobId` on every line, and Bull Board mounted in the api for admins.

---

## 6. Risks to verify first (spikes before building on them)

1. ~~**demoparser2 under Bun.**~~ Verified: it works under Bun 1.3. A full analysis of a 250 MB demo takes about 1.5 s.
2. **`steam-user` / `globaloffensive` under Bun.** The same approach applies. The GC client is also the most likely thing to break when Valve changes protos.
3. **CS2 in headless gamescope.** Prove a 10s capture of `playdemo` + `spec_player` + `demo_gototick` on the target GPU box before building the recorder queue. If Linux is flaky, the `Recorder` port allows a Windows host adapter, where Allstar-style setups are proven.
4. **Valve rate limits and expiry.** Demos disappear after about 30 days and the GC throttles aggressively. Mitigations: one bot, a 1 req/s limiter, and backoff.

---

## 7. Build order

Status: steps 1–3 are done.

1. **Scaffold:** turborepo, bun workspaces, oxlint/oxfmt, tsconfig, compose (pg/redis/seaweedfs), `db`, `config`, `queue`, `storage`.
2. **Parser:** fetch fixtures, the normalize → stats → detectors pipeline, and tests on the three demos. _This is the heart. Iterate on highlight quality here._
3. **API + auth:** better-auth email, the Steam OpenID plugin, match-auth setup, and match/highlight read endpoints.
4. **Web:** ui kit (button and friends), login, setup, feed, match page with the radar replay fallback.
5. **Steam worker:** sync, resolve, download, and the dev `enqueue` CLI. The end-to-end flow then works with radar replays.
6. **Recorder spike, then `Cs2Recorder`:** batching, upload, and swapping video into the UI.
7. **Polish:** reels, lazy renders, SSE progress, settings.
