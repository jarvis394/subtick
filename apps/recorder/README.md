# subtick recorder

Turns highlights into video clips. It runs CS2 (the Windows build) with [HLAE](https://www.advancedfx.org/), drives it through the netcon console, and consumes `clip.record` jobs: one job per match, with the demo loaded once and its clips recorded in demo order.

The recorder is one program, `subtick-recorder`, with a command per job: `setup`, `doctor`, `run`, `smoke`, `update` and `version` (`--help` lists them). It runs in two ways:

- **On Windows**, natively: the game runs on the desktop with the machine's own GPU driver and an existing Steam install of CS2. Easiest for a gaming PC.
- **On Linux**, in Docker: Wine, a headless Xorg and the NVIDIA driver come with the image (`ghcr.io/jarvis394/subtick-recorder`). For a headless GPU box.

It needs two things from the instance: its Redis, where jobs come from, and subtick's api, which it reaches with a recorder token. Through the api it learns what to record, gets short-lived URLs to download the demo and upload the clips, and reports each result. It holds no database or bucket credentials, so it can run on the same machine as everything else or alone on whichever box has the GPU.

## Install on Windows

Needs Windows 10 or 11 (x64), CS2 installed with Steam, and about 1 GB of disk.

1. Download `subtick-recorder-windows-x64.exe` from the [latest `recorder-v*` release](https://github.com/jarvis394/subtick/releases), e.g. as `C:\subtick\subtick-recorder.exe`.
2. Exclude the install folder (`C:\subtick` unless you pass `--dir`) from Windows Defender: it takes gbe_fork, the Steam emulator CS2 runs on here, for a threat and deletes it. Windows Security → Virus & threat protection → Manage settings → Exclusions → Add an exclusion → Folder, or in an administrator PowerShell `Add-MpPreference -ExclusionPath 'C:\subtick'`. If you skip this, `setup` stops and says so.
3. Run `subtick-recorder setup` in a terminal. It finds CS2 through Steam (pass `--cs2-install "<the folder that holds game\>"` otherwise) and installs into `C:\subtick`: HLAE with its ffmpeg, gbe_fork, the mirv_pov hook with `HLAE_POV=1`, and `cs2\`, a copy of the install's `game\bin` (where gbe_fork replaces Steam's DLL) with junctions to the rest. Versions and checksums are pinned in [`pins.json`](pins.json), shared with the Docker image. The install Steam knows is left as it is, apart from a `game\csgo\subtick` folder the demos are copied to. Without an ffmpeg on `PATH`, it puts one in `%LOCALAPPDATA%\subtick-recorder\ffmpeg`.
4. Fill in `SUBTICK_URL`, `RECORDER_TOKEN` and `REDIS_URL` in the settings file `setup` created, `%LOCALAPPDATA%\subtick-recorder\recorder.env` (see [Configure](#configure)).
5. Run `subtick-recorder doctor`, then `subtick-recorder run`. It takes jobs until stopped; Ctrl+C lets the current batch finish.

The game opens a window on the desktop while it records; a CS2 you start from Steam yourself is never touched. Run `setup` again after a CS2 update (`doctor` says when): it copies the new `game\bin` and skips everything already in place.

## Install on Linux (Docker)

Needs an NVIDIA GPU with the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/), about 65 GB of disk for CS2 unless you reuse an install you already have (see below), and about 7 GB for the Wine prefix. Current DXVK needs Vulkan 1.3; older GPUs and drivers (e.g. Kepler on driver 470) run with `DXVK_VERSION=1.10.3`.

Put [`docker/compose.yml`](docker/compose.yml) in a folder with a `recorder.env` holding `SUBTICK_URL`, `RECORDER_TOKEN`, `REDIS_URL` and any [settings](#settings), then run `docker compose up -d`. The first start creates the Wine prefix and installs .NET and HLAE (a few minutes), then the game files. Later starts take seconds. `docker compose exec recorder subtick-recorder doctor` checks it.

Without compose:

```sh
docker run -d --init --restart unless-stopped --name subtick-recorder --runtime nvidia --network host \
  --env-file recorder.env -v subtick-cs2:/cs2 -v subtick-wine:/wine \
  ghcr.io/jarvis394/subtick-recorder
```

### Game files: `CS2_SOURCE`

- **`download`** (default): steamcmd installs the Windows build into `CS2_DIR` anonymously (no login needed) and updates it on every start.
- **`path`**: `CS2_DIR` already holds a Windows CS2 install, e.g. a mounted Steam library folder. Nothing is downloaded or updated.
- **`server`**: you already run a CS2 dedicated server (e.g. from a game panel). Mount its install read-only at `CS2_SERVER_DIR`; the recorder downloads only the Windows binaries (~5 GB) and builds `CS2_DIR` as symlinks into the server install plus those binaries. The server is never written to, and its mods are left out: `CS2_DIR` gets a copy of its `gameinfo.gi` without the `csgo/addons/` search paths (game panels add Metamod there, and its plugins' Windows DLLs crash the game) and no `addons` folder. Both must be on the same CS2 build. When the server updates, the recorder notices before its next job, puts the job back and exits; the container's restart policy reruns the bootstrap, which downloads the matching binaries. Until the server is on CS2's current build, the bootstrap exits and Docker retries.

## Configure

The recorder reads its settings from the environment. A settings file fills in what the environment doesn't set: `%LOCALAPPDATA%\subtick-recorder\recorder.env` on Windows, `~/.config/subtick-recorder/recorder.env` elsewhere, or the file `SUBTICK_RECORDER_CONFIG` names. In Docker, `env_file` (or `--env-file`) is the environment.

Every recorder needs three values:

```sh
SUBTICK_URL=https://subtick.example.com   # the instance's PUBLIC_URL
RECORDER_TOKEN=strec_...
REDIS_URL=redis://127.0.0.1:6379
```

- **Token**: in subtick, an admin opens **Manage instance → Recorders** (in the account menu), adds a recorder and gets a token, shown once. Only admins see these pages; make the first admin with `bun run --filter @subtick/api grant-admin <email | steamId64>` on the instance, then grant others in **Manage instance → Users**.
- **Redis**: on another machine than the instance's, reach it through an SSH tunnel (`ssh -L 6379:127.0.0.1:6379 your-server`) or a private network, never an open port.
- **Storage**: the URLs the recorder downloads demos from and uploads clips to are made for the instance's `S3_PUBLIC_ENDPOINT`, so that origin has to be reachable from the machine.

Recorders can run on several machines, like CI runners. Each reports its health every 15 s (online, what it is doing, GPU, last error) and takes its settings from subtick:

- **Pause**: a paused recorder finishes its current job and takes no new ones.
- **New token / Remove**: the old token stops working at once.
- **Update** (HLAE build): offers the newest mirv_pov fork release with the HLAE release it is built on (looked up on GitHub). In Docker the machine writes the pick next to its Wine prefix (`hlae-target`) and restarts between jobs; the bootstrap downloads it, checks the sha256 GitHub lists for it, and uses it over the image's pins while it is the newer of the two. On Windows the pick is not installed; set `HLAE_VERSION` and rerun `setup`.

## Update

- **Windows**: `subtick-recorder update` downloads the newest `recorder-v*` release for this platform, checks it against the release's `SHA256SUMS` and replaces the executable (the running one steps aside as `.old` and is deleted on the next start). It says when the new release installs other game-side files, so `setup` has to run again. Restart a running recorder afterwards. `update --check` only looks.
- **Docker**: `docker compose pull && docker compose up -d`. The old container finishes its batch first (up to the compose file's 30 min grace period). `RECORDER_TAG` in the compose environment pins a release instead of `latest`.

## How it works

For each clip:

1. Seek to five seconds before the clip and spectate the player. The lead-in plays at 4× speed, and the spectate is sent again 2.5 s before the start, since CS2 can ignore a `spec_player` sent right after a seek.
2. HLAE captures between two `mirv_cmd` tick triggers, offline at a fixed frame rate: a slow GPU makes recording slower, never choppier.
3. Mux in the game audio, trim to length, take a poster frame at the last kill.
4. Upload the clip through a presigned URL and report it to subtick, which writes the `clip` row.

A clip that fails gets one more try in a freshly started game; failing to load the demo fails the job, which the queue retries. A CS2 session can slow down as it records, so the recorder restarts the game after any clip that renders slower than 8× real time (scaled to 60 fps). Later matches load into the running game.

In Docker:

```
┌──────────────── recorder container (--runtime nvidia) ─────────────────┐
│ Xorg (headless, NVIDIA) · PulseAudio null sink · x11vnc (localhost)    │
│ Wine prefix: .NET 4.8 · HLAE · DXVK · gbe_fork (Steam emulator)        │
│ CS2 cs2.exe ◄─ HLAE AfxHookSource2 ◄─ netcon :2121 ◄─ subtick-recorder │
└────────────────────────────────────────────────────────────────────────┘
     ▲ demos (presigned GET)   clips (presigned PUT) ▼   jobs (Redis) · everything else (subtick api)
```

On start, [`docker/entrypoint.sh`](docker/entrypoint.sh) starts Xorg on the GPU nvidia-smi reports, a null audio sink and, with `VNC_PASSWORD`, a VNC view; then [`docker/bootstrap.sh`](docker/bootstrap.sh) prepares the Wine prefix, DXVK, HLAE, the game files and gbe_fork, skipping each step that is already in place. On Windows, `setup` does the same once and the game runs on the desktop.

### Steam: emulated

CS2 won't start without Steam. [gbe_fork](https://github.com/Detanup01/gbe_fork)'s `steam_api64.dll` and [`gbe/steam_settings/`](gbe/steam_settings) (offline, no networking) are laid over `game/bin/win64`, so no Steam client runs: no account, no Steam Guard, nothing to sign in. A game update restores Steam's own DLL, so the bootstrap lays gbe_fork over it again after every update (on Windows, rerun `setup`). CS2 can't fetch player avatars without Steam, so the team bar shows "N alive" counts instead. Running CS2 on a Steam emulator is likely against the Steam Subscriber Agreement; it only ever plays local demos here.

### The look of a clip

[`cfg/`](cfg) is copied into the game's config folder (HLAE's `USRLOCALCSGO`) on every start:

- `subtick.cfg`: player HUD on; demo UI, build watermark and x-ray off; the team bar shows "N alive" counts, not a spectator's card per player; game volume pinned to 1, so a clip's audio level doesn't depend on the machine; the recorded player's own crosshair (`cl_show_observer_crosshair 2`), as the demo reports it. Demos from before CS2's September 2026 crosshair-code change keep the default crosshair.
- `cs2_video.txt`: resolution (rewritten from `RECORD_WIDTH`/`RECORD_HEIGHT` on copy), lowest details, FSR off.

### The player's HUD (`HLAE_POV`)

CS2 draws demo playback with the spectator HUD, even in first person. Official HLAE's `mirv_pov` (the player's own HUD in a demo) is for CS:GO only; [WangChuDi/advancedfx](https://github.com/WangChuDi/advancedfx) ports it to CS2 as a drop-in `AfxHookSource2.dll`. `pins.json` pins a release by checksum, and with `HLAE_POV=1` the bootstrap or `setup` puts it over HLAE's own hook, which is kept to switch back. It must be built for the same HLAE version as `HLAE_VERSION`; otherwise HLAE's own hook stays. When a CS2 update breaks the fork's HUD hooks, the recorder notices on the first clip and records the spectator HUD until the game restarts.

### Performance

Measured on a GTX 650 (1 GB) in Docker at 1280×720 and 60 fps: about 23 s from CS2 start to a loaded demo, then 6–7 s of rendering per second of clip (a 10 s clip takes about 70 s). A match with six highlights takes 10–15 minutes. Render time grows with the resolution and `RECORD_FPS`.

## Settings

Clips are 1280×720 at 60 fps unless `RECORD_WIDTH`, `RECORD_HEIGHT` and `RECORD_FPS` say otherwise.

| variable                        | default                           | what                                                                                                                              |
| ------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `SUBTICK_URL`, `RECORDER_TOKEN` |                                   | required: the instance and this machine's token ([Configure](#configure))                                                         |
| `REDIS_URL`                     |                                   | required: the instance's Redis, where jobs come from                                                                              |
| `RECORD_WIDTH`, `RECORD_HEIGHT` | `1280`, `720`                     | capture size: the game's window and `cs2_video.txt`'s resolution                                                                  |
| `RECORD_FPS`                    | `60`                              | HLAE's offline capture rate                                                                                                       |
| `HLAE_VERSION`                  | from `pins.json`                  | HLAE release; HLAE follows CS2 updates closely, so bump it when a CS2 update breaks the hook                                      |
| `HLAE_POV`                      | `0`                               | `1`: clips show the recorded player's own HUD ([above](#the-players-hud-hlae_pov)); on Windows, rerun `setup` after changing it   |
| `SCRATCH_DIR`                   | the system temp folder            | where demos and takes are kept while a match records                                                                              |
| `WINDOWS_DIR`                   | `C:\subtick`                      | Windows: where `setup` installs HLAE and the game folder                                                                          |
| `CS2_INSTALL`                   | found through Steam               | Windows: the Steam install `setup` builds the game folder from (`--cs2-install`)                                                  |
| `CS2_DIR`                       | `/cs2`, `WINDOWS_DIR\cs2`         | the game folder the recorder starts (the one with `game/`)                                                                        |
| `GAME_HOST`                     | `windows` on Windows, else `wine` | where the game runs; `setup` sets `windows` for a recorder in WSL                                                                 |
| `CS2_SOURCE`                    | `download`                        | Docker: where the game files come from ([above](#game-files-cs2_source))                                                          |
| `CS2_SERVER_DIR`                |                                   | Docker, `CS2_SOURCE=server`: a Linux dedicated-server install                                                                     |
| `DXVK_VERSION`                  | `2.7.1`                           | Docker: `1.10.3` for GPUs or drivers without Vulkan 1.3                                                                           |
| `WINEPREFIX`                    | `/wine/pfx`                       | Docker: the prefix, inside the `/wine` volume                                                                                     |
| `XORG_BUSID`                    | from nvidia-smi                   | Docker: the GPU Xorg runs on, as `PCI:<bus>:<device>:<function>` in decimal, when the first GPU nvidia-smi lists is the wrong one |
| `VNC_PASSWORD`                  |                                   | Docker: starts a VNC server on `127.0.0.1:5900` to watch the game                                                                 |
| `LOG_LEVEL`                     | `INFO`                            | `TRACE` logs every CS2 console line                                                                                               |

## Troubleshooting

`subtick-recorder doctor` (in Docker, `docker compose exec recorder subtick-recorder doctor`) checks the game folder, the Steam emulator, Defender, HLAE and its hook, WSL networking, ffmpeg, the GPU, Redis and the token, one line each with a fix.

`subtick-recorder smoke <demo.dem> [tick] [player]` records two clips from a local demo without subtick or the queue, restarting the game between them. Stop the recorder first, since they share the game. In Docker: `docker compose run --rm -v <demos>:/demos:ro recorder smoke /demos/match.dem` with the recorder's container stopped.

With `VNC_PASSWORD` set, a VNC client on `127.0.0.1:5900` of the Docker host (through an SSH tunnel from elsewhere) shows the game as it records.

## Development

On a Windows machine, the recorder runs from source in WSL and the game on Windows, through WSL's interop. WSL needs mirrored networking (`networkingMode=mirrored` in `.wslconfig`): the worker reaches the game's console on `127.0.0.1`. The same commands work, with the settings file at `~/.config/subtick-recorder/recorder.env`, where `setup` adds `GAME_HOST=windows`; paths in it can be Windows paths. From source, the repo's `.env` fills in what neither the environment nor `recorder.env` sets; `--no-env-file` keeps Bun from loading that `.env` itself first, which would let it win over `recorder.env`.

```sh
bun --no-env-file apps/recorder/src/cli.ts setup   # installs into C:\subtick, as the Windows executable does
bun --no-env-file apps/recorder/src/cli.ts doctor
bun run --filter @subtick/recorder-worker dev      # run, restarting on changes
bun run --filter @subtick/recorder-worker test
```

The root `bun run dev` leaves the recorder out. With the repo's `.env` pointing at the instance's database and Redis:

```sh
bun run --filter @subtick/recorder-worker enqueue <matchId>... [--only <highlightId>]   # (re-)record a match's highlights
```

Bump `RECORDER_VERSION` in `src/record.ts` when the look changes; clips from older versions are re-rendered when their match is recorded again.

### Releases

`bun run --filter @subtick/recorder-worker compile [windows|linux]` builds the executables into `dist/` with their `SHA256SUMS` (`VERSION` sets the version they report). Pushing a tag `recorder-v<version>` runs [`.github/workflows/recorder-release.yml`](../../.github/workflows/recorder-release.yml), which tests, compiles and publishes both executables as a GitHub release and pushes the image to `ghcr.io/<owner>/subtick-recorder`.

To build the image yourself, from the repo root: `docker build -f apps/recorder/Dockerfile -t subtick-recorder .`. [`scripts/deploy.sh`](scripts/deploy.sh) is for a machine that builds the image from its own checkout of `main` instead of pulling releases: it rebuilds, waits for the current batch and swaps the container. Its header lists the layout it expects and the variables that override it, including `RECORDER_CS2_SERVER` for `CS2_SOURCE=server`.
