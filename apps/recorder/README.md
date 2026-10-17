# @subtick/recorder-worker

Turns highlights into video clips. It runs CS2 (the Windows build) with [HLAE](https://www.advancedfx.org/) under Wine on a headless NVIDIA GPU, drives it through the netcon console, and consumes `clip.record` jobs: one job per match, with the demo loaded once and its clips recorded in demo order.

For each clip:

1. Seek to five seconds before the clip and spectate the player.
2. HLAE captures between two `mirv_cmd` tick triggers, offline at a fixed 60 fps: a slow GPU makes recording slower, never choppier.
3. Mux in the game audio, trim to length, take a poster frame at the last kill.
4. Upload to the `clips` bucket and write the `clip` row.

```
┌──────────────── recorder container (--runtime nvidia) ─────────────────┐
│ Xorg (headless, NVIDIA) · PulseAudio null sink · x11vnc (localhost)    │
│ Wine prefix: Steam client (signed in) · .NET 4.8 · HLAE · DXVK         │
│ CS2 cs2.exe ◄─ HLAE AfxHookSource2 ◄─ netcon :2121 ◄─ bun worker       │
└────────────────────────────────────────────────────────────────────────┘
          ▲ demos (S3)          clips (S3) ▼          jobs (Redis) / rows (Postgres)
```

It only talks to Postgres, Redis and S3 through URLs, so it can run on the same machine as everything else, or alone on whichever box has the GPU.

## Requirements

- An NVIDIA GPU with the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/). Tested on a GTX 650 (1 GB, driver 470); anything with Vulkan 1.3 can use current DXVK.
- About 75 GB of disk for CS2, unless you reuse an install you already have (see below), plus about 7 GB for the Wine prefix.
- A Steam account for the game client. CS2 is free, but the account must not be in use elsewhere while recording, and it can't also be the steam worker's GC bot: one account runs one game session at a time.

## Run

```sh
docker build -f apps/recorder/Dockerfile -t subtick-recorder .
docker run -d --init --restart unless-stopped --name subtick-recorder --runtime nvidia --network host \
  --env-file recorder.env \
  -v subtick-cs2:/cs2 -v subtick-wine:/wine \
  subtick-recorder
```

The first start creates the Wine prefix and installs .NET, HLAE and Steam (a few minutes), then the game files. Later starts take seconds.

## Environment

| variable                                                  | default     | what                                                                                                                                                                       |
| --------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `REDIS_URL`, `S3_*`                       |             | as for the other workers                                                                                                                                                   |
| `SUBTICK_URL`, `RECORDER_TOKEN`                           |             | join the instance's recorder fleet (see below). Without them the machine runs standalone.                                                                                  |
| `CS2_SOURCE`                                              | `download`  | where the game files come from, see below                                                                                                                                  |
| `CS2_DIR`                                                 | `/cs2`      | the CS2 install (the folder with `game/`)                                                                                                                                  |
| `CS2_SERVER_DIR`                                          |             | `CS2_SOURCE=server` only: a Linux dedicated-server install                                                                                                                 |
| `STEAM_MODE`                                              | `client`    | `emulator`: CS2 runs on gbe_fork instead of the Steam client, so the machine needs no Steam account (see below)                                                            |
| `STEAM_USERNAME`, `STEAM_PASSWORD`, `STEAM_SHARED_SECRET` |             | standalone only: signs Steam in on the first start (the secret answers Steam Guard; without one, see below). Afterwards the prefix keeps a token and these can be removed. |
| `VNC_PASSWORD`                                            |             | starts a VNC server on `127.0.0.1:5900` to watch the game or sign in by hand                                                                                               |
| `DXVK_VERSION`                                            | `2.7.1`     | `1.10.3` for GPUs or drivers without Vulkan 1.3 (e.g. Kepler on driver 470)                                                                                                |
| `HLAE_VERSION`                                            | `2.192.8`   | HLAE release; HLAE follows CS2 updates closely, so bump it when CS2 updates break the hook                                                                                 |
| `HLAE_POV`                                                | `0`         | `1`: clips show the recorded player's own HUD instead of CS2's spectator HUD, through the `mirv_pov` fork of HLAE's hook (see below)                                       |
| `WINEPREFIX`                                              | `/wine/pfx` | the prefix, inside the `/wine` volume                                                                                                                                      |

### A fleet of recorders

Recorders can run on several machines, like CI runners. In subtick, an admin opens **Manage instance → Recorders** (in the account menu), adds a recorder and gets a token, shown once. Put it in that machine's `recorder.env`:

```sh
SUBTICK_URL=https://subtick.example.com   # the instance's PUBLIC_URL
RECORDER_TOKEN=strec_...
```

The machine then reports its health every 15 s (online, what it's doing, which Steam account is signed in, GPU, last error) and takes its settings from subtick:

- **Steam account**: admins add accounts under **Manage instance → Steam accounts** (stored encrypted) and assign each to one recorder. The machine signs in with it, switching accounts between jobs if another one is signed in. Without a stored shared secret, Steam asks for a Steam Guard code on that first sign-in (by email, or from the Steam mobile app); the recorder's card then shows a field for it and the machine types it in.
- **Pause**: a paused recorder finishes its current job and takes no new ones.
- **New token / Remove**: the old token stops working at once.

Every machine still needs `DATABASE_URL`, `REDIS_URL` and `S3_*`. Only admins see these pages; make the first admin with `bun run --filter @subtick/api grant-admin <email | steamId64>`, then grant others in **Manage instance → Users**.

### Game files: `CS2_SOURCE`

- **`download`**: steamcmd installs the Windows build into `CS2_DIR` anonymously (no login needed) and updates it on every start. Simplest; costs ~75 GB.
- **`path`**: `CS2_DIR` already holds a Windows CS2 install, e.g. a mounted Steam library folder. Nothing is downloaded or updated.
- **`server`**: you already run a CS2 dedicated server (e.g. from a game panel). Mount its install read-only at `CS2_SERVER_DIR`; the recorder downloads only the Windows binaries (~5 GB) and builds `CS2_DIR` as symlinks into the server install plus those binaries. The server is never written to. Both must be on the same CS2 build: when CS2 updates, update the server and restart the recorder.

### Steam: client or emulated (`STEAM_MODE`)

CS2 won't start without Steam. With `STEAM_MODE=client` (the default) that is the Windows Steam client in the prefix, signed in to an account (below). With `STEAM_MODE=emulator`, the bootstrap lays [gbe_fork](https://github.com/Detanup01/gbe_fork)'s `steam_api64.dll` and `gbe/steam_settings/` (offline, no networking) over `game/bin/win64`, and the Steam client is never started: no account, no Steam Guard, nothing to sign in again. Steam's own DLL is kept as `steam_api64.steam.dll` and put back when the mode returns to `client`. CS2 can't fetch player avatars without Steam, so the team bar shows "N alive" counts instead (`subtick.cfg`). Running CS2 on a Steam emulator is likely against the Steam Subscriber Agreement; it only ever plays local demos here.

### The player's HUD (`HLAE_POV`)

CS2 draws demo playback with the spectator HUD, even in first person. Official HLAE's `mirv_pov` (the player's own HUD in a demo) is for CS:GO only; [WangChuDi/advancedfx](https://github.com/WangChuDi/advancedfx) ports it to CS2 as a drop-in `AfxHookSource2.dll`. The image pins a release by checksum (`Dockerfile`), and with `HLAE_POV=1` the bootstrap puts it over HLAE's own hook, which is kept to switch back. It must be built for the same HLAE version as `HLAE_VERSION`; otherwise the bootstrap keeps HLAE's hook. When a CS2 update breaks the fork's HUD hooks, the recorder notices on the first clip and records the spectator HUD until the game restarts.

### Signing in to Steam

`STEAM_MODE=client` only. In a fleet, assign the machine an account in subtick (above). Standalone, either set `STEAM_USERNAME`/`STEAM_PASSWORD` (and `STEAM_SHARED_SECRET` for accounts with a mobile authenticator), or set `VNC_PASSWORD`, tunnel the port (`ssh -N -L 5901:localhost:5900 <host>`), open `vnc://localhost:5901` and sign in with "Remember me" checked. Either way it's once per prefix.

Standalone, accounts without `STEAM_SHARED_SECRET` need a Steam Guard code (email or mobile app) on the first sign-in. The recorder logs a warning and waits up to 15 minutes for it:

```sh
docker exec subtick-recorder sh -c 'echo CODE > /wine/steam-guard-code'
```

## The look of a clip

`cfg/` is copied into the game's config folder (HLAE's `USRLOCALCSGO`) on every start:

- `subtick.cfg`: HUD and overlays (player HUD on; demo UI, build watermark, x-ray off).
- `subtick.cfg`: the team bar shows "N alive" counts, not a spectator's card per player.
- `cs2_video.txt`: resolution and quality: 1280×720, lowest details, FSR off. On the 1 GB GTX 650 FSR off renders correctly but about 30% slower than FSR performance mode (`setting.videocfg_fsr_detail` `3`), which earlier tests needed to avoid magenta (missing) materials.

After a deploy, `scripts/smoke.ts` records one clip without the database or the queue (usage in the file).

Bump `RECORDER_VERSION` in `src/record.ts` when the look changes; clips from older versions are re-rendered when their match is recorded again (`bun run enqueue <matchId>`).

## Performance

On the GTX 650: ~23 s from CS2 start to a loaded demo, then about 6–7 s of rendering per second of clip (a 10 s clip takes ~70 s). A typical match with six highlights takes 10–15 minutes. One CS2 session slows down as it records (15–30× after five clips), so the recorder restarts the game every four clips and after any clip slower than 12×.

## Dev

```sh
bun run enqueue <matchId>... [--only <highlightId>]   # (re-)record a match's highlights
LOG_LEVEL=TRACE                                       # logs every CS2 console line
```

`spike/` holds the original feasibility spike and its findings.
