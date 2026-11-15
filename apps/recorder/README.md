# @subtick/recorder-worker

Turns highlights into video clips. It runs CS2 (the Windows build) with [HLAE](https://www.advancedfx.org/) under Wine on a headless NVIDIA GPU, drives it through the netcon console, and consumes `clip.record` jobs: one job per match, with the demo loaded once and its clips recorded in demo order.

For each clip:

1. Seek to five seconds before the clip and spectate the player.
2. HLAE captures between two `mirv_cmd` tick triggers, offline at a fixed 60 fps: a slow GPU makes recording slower, never choppier.
3. Mux in the game audio, trim to length, take a poster frame at the last kill.
4. Upload to the `clips` bucket and report the clip to subtick, which writes the `clip` row.

```
┌──────────────── recorder container (--runtime nvidia) ─────────────────┐
│ Xorg (headless, NVIDIA) · PulseAudio null sink · x11vnc (localhost)    │
│ Wine prefix: .NET 4.8 · HLAE · DXVK · gbe_fork (Steam emulator)        │
│ CS2 cs2.exe ◄─ HLAE AfxHookSource2 ◄─ netcon :2121 ◄─ bun worker       │
└────────────────────────────────────────────────────────────────────────┘
     ▲ demos (presigned GET)   clips (presigned PUT) ▼   jobs (Redis) · everything else (subtick api)
```

It needs two things from the instance: Redis, where its jobs come from, and subtick's api, which it reaches with a recorder token. Through the api it learns what to record, gets short-lived URLs to download the demo and upload the clips, and reports each result. It holds no database or bucket credentials, so it can run on the same machine as everything else, or alone on whichever box has the GPU.

## Requirements

- An NVIDIA GPU with the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/). Tested on a GTX 650 (1 GB, driver 470); anything with Vulkan 1.3 can use current DXVK.
- About 75 GB of disk for CS2, unless you reuse an install you already have (see below), plus about 7 GB for the Wine prefix.

## Run

```sh
docker build -f apps/recorder/Dockerfile -t subtick-recorder .
docker run -d --init --restart unless-stopped --name subtick-recorder --runtime nvidia --network host \
  --env-file recorder.env \
  -v subtick-cs2:/cs2 -v subtick-wine:/wine \
  subtick-recorder
```

The first start creates the Wine prefix and installs .NET and HLAE (a few minutes), then the game files. Later starts take seconds.

To update a running recorder to the latest `main`, run `apps/recorder/scripts/deploy.sh` from its checkout. It builds the new image while the old one keeps recording, waits for the current batch to finish (`--now` skips that), then recreates the container with the same flags. It expects `recorder.env` next to the checkout; the script's header lists the paths it assumes and how to override them.

## Environment

| variable                        | default     | what                                                                                                                                 |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `REDIS_URL`                     |             | as for the other workers: the queue its jobs come from                                                                               |
| `SUBTICK_URL`, `RECORDER_TOKEN` |             | required: the instance and this machine's token (see below)                                                                          |
| `CS2_SOURCE`                    | `download`  | where the game files come from, see below                                                                                            |
| `CS2_DIR`                       | `/cs2`      | the CS2 install (the folder with `game/`)                                                                                            |
| `CS2_SERVER_DIR`                |             | `CS2_SOURCE=server` only: a Linux dedicated-server install                                                                           |
| `VNC_PASSWORD`                  |             | starts a VNC server on `127.0.0.1:5900` to watch the game                                                                            |
| `DXVK_VERSION`                  | `2.7.1`     | `1.10.3` for GPUs or drivers without Vulkan 1.3 (e.g. Kepler on driver 470)                                                          |
| `HLAE_VERSION`                  | `2.193.0`   | HLAE release; HLAE follows CS2 updates closely, so bump it when CS2 updates break the hook                                           |
| `HLAE_POV`                      | `0`         | `1`: clips show the recorded player's own HUD instead of CS2's spectator HUD, through the `mirv_pov` fork of HLAE's hook (see below) |
| `WINEPREFIX`                    | `/wine/pfx` | the prefix, inside the `/wine` volume                                                                                                |

### On a Windows machine, from WSL

With `GAME_HOST=windows` the worker runs in WSL and the game runs on Windows itself: no Docker, Wine or Xorg, and the machine's own GPU driver. `scripts/setup-wsl.sh` installs HLAE into `WINDOWS_DIR` (`/mnt/c/subtick`) and builds `CS2_DIR` from an existing Steam install: a copy of `game/bin`, where gbe_fork goes, and junctions to the rest. The install Steam knows is left as it is, apart from a `game/csgo/subtick` folder the demos are copied to.

```sh
CS2_INSTALL="/mnt/c/.../Counter-Strike Global Offensive" apps/recorder/scripts/setup-wsl.sh
GAME_HOST=windows CS2_DIR=/mnt/c/subtick/cs2 bun apps/recorder/src/main.ts
```

- WSL needs mirrored networking (`networkingMode=mirrored` in `.wslconfig`): the worker reaches the game's console on `127.0.0.1`.
- Windows Defender takes gbe_fork for a threat and blocks the download, so `WINDOWS_DIR` needs an exclusion.
- The game opens a window on the desktop while it records. Rerun the setup after a CS2 update.
- HLAE builds picked in **Manage instance → Recorders** aren't installed here; set `HLAE_VERSION` and rerun the setup. `HLAE_POV` isn't set up by the script yet.

### A fleet of recorders

Recorders can run on several machines, like CI runners. In subtick, an admin opens **Manage instance → Recorders** (in the account menu), adds a recorder and gets a token, shown once. Put it in that machine's `recorder.env`:

```sh
SUBTICK_URL=https://subtick.example.com   # the instance's PUBLIC_URL
RECORDER_TOKEN=strec_...
```

The machine then reports its health every 15 s (online, what it's doing, GPU, last error) and takes its settings from subtick:

- **Pause**: a paused recorder finishes its current job and takes no new ones.
- **New token / Remove**: the old token stops working at once.

Every machine still needs `REDIS_URL`; on another machine than the instance's, reach it through an SSH tunnel or a private network, never an open port. The URLs it downloads demos from and uploads clips to are made for `S3_PUBLIC_ENDPOINT`, so that origin has to be reachable from the machine. Only admins see these pages; make the first admin with `bun run --filter @subtick/api grant-admin <email | steamId64>`, then grant others in **Manage instance → Users**.

### Game files: `CS2_SOURCE`

- **`download`**: steamcmd installs the Windows build into `CS2_DIR` anonymously (no login needed) and updates it on every start. Simplest; costs ~75 GB.
- **`path`**: `CS2_DIR` already holds a Windows CS2 install, e.g. a mounted Steam library folder. Nothing is downloaded or updated.
- **`server`**: you already run a CS2 dedicated server (e.g. from a game panel). Mount its install read-only at `CS2_SERVER_DIR`; the recorder downloads only the Windows binaries (~5 GB) and builds `CS2_DIR` as symlinks into the server install plus those binaries. The server is never written to, and its mods are left out: `CS2_DIR` gets a copy of its `gameinfo.gi` without the `csgo/addons/` search paths (game panels add Metamod there, and its plugins' Windows DLLs crash the game) and no `addons` folder. Both must be on the same CS2 build. When the server updates, the recorder notices before its next job, puts the job back and exits; the container's restart policy reruns the bootstrap, which downloads the matching binaries (until the server has updated to CS2's current build, the bootstrap exits and Docker retries). With `scripts/deploy.sh`, set `RECORDER_CS2_SERVER` to the server's install to mount it read-only.

### Steam: emulated

CS2 won't start without Steam. The bootstrap lays [gbe_fork](https://github.com/Detanup01/gbe_fork)'s `steam_api64.dll` and `gbe/steam_settings/` (offline, no networking) over `game/bin/win64`, so no Steam client runs: no account, no Steam Guard, nothing to sign in. A game update restores Steam's own DLL, so the bootstrap lays gbe_fork over it again after every update. CS2 can't fetch player avatars without Steam, so the team bar shows "N alive" counts instead (`subtick.cfg`). Running CS2 on a Steam emulator is likely against the Steam Subscriber Agreement; it only ever plays local demos here.

### The player's HUD (`HLAE_POV`)

CS2 draws demo playback with the spectator HUD, even in first person. Official HLAE's `mirv_pov` (the player's own HUD in a demo) is for CS:GO only; [WangChuDi/advancedfx](https://github.com/WangChuDi/advancedfx) ports it to CS2 as a drop-in `AfxHookSource2.dll`. The image pins a release by checksum (`Dockerfile`), and with `HLAE_POV=1` the bootstrap puts it over HLAE's own hook, which is kept to switch back. It must be built for the same HLAE version as `HLAE_VERSION`; otherwise the bootstrap keeps HLAE's hook. When a CS2 update breaks the fork's HUD hooks, the recorder notices on the first clip and records the spectator HUD until the game restarts.

In a fleet, **Manage instance → Recorders** shows each machine's HLAE build and offers an **Update** to the newest fork release with the HLAE release it's built on (looked up on GitHub). The machine writes the build next to its Wine prefix (`hlae-target`) and restarts between jobs; the bootstrap downloads it, checks the sha256 GitHub lists for it, and uses it over the image's pins while it's the newer of the two.

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
