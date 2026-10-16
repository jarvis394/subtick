# Recorder spike: CS2 under Wine on a headless NVIDIA box

Risk #3 in `ARCHITECTURE.md`. Target: `homelab` (GTX 650, Kepler, driver 470, Vulkan 1.2).

## Layout on the host (`~/subtick-recorder`)

| path                 | what                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| `winbin/`            | Windows client depot 2347771 (`download_depot`, anonymous, ~4.8 GB)                     |
| `upper/`, `work/`    | overlay upper/work dirs; everything the game writes lands here                          |
| volume `subtick-cs2` | overlay: `winbin` over the Pelican CS2 server volume (never written)                    |
| `prefix/`            | Wine prefix (`/wine/pfx` in the container), including the signed-in Steam client        |
| `demos/`             | demo files                                                                              |

```sh
docker volume create --driver local --opt type=overlay --opt device=overlay \
  --opt o=lowerdir=$R/winbin:/var/lib/pelican/volumes/<uuid>,upperdir=$R/upper,workdir=$R/work subtick-cs2
docker run -d --init --name subtick-cs2-spike --runtime nvidia --network host \
  -v subtick-cs2:/cs2 -v $R/prefix:/wine -v $R/demos:/demos subtick-cs2-spike
```

VNC listens on the host's `127.0.0.1:5900`; tunnel with `ssh -N -L 5901:localhost:5900 homelab`.

## Findings (Oct 2026)

- Headless Xorg on the NVIDIA driver works in an unprivileged container (`--runtime nvidia`, `NVIDIA_DRIVER_CAPABILITIES=all`): GL 4.6, Vulkan 1.2.
- The anonymous server install already ships the full game content; only the Windows binaries depot is missing, and it downloads anonymously too.
- **The Windows binaries must match the content build exactly**, or CS2 aborts with `FATAL ERROR: shaders_pc.vpk`. Both layers must update together after every CS2 patch, and an overlay needs a remount (container restart) after its lower layer changes.
- CS2 exits without a signed-in Steam client (`SteamAPI_IsSteamRunning() did not locate a running instance`). Windows Steam runs in the prefix once `steamwebhelper` uses Wine's builtin D3D; its UI text does not render, but sign-in works blind or by QR. A Steam account runs one game session at a time, so the recorder needs its own account, separate from the GC bot.
- **DXVK 1.10.3: renders the demo correctly** (HUD, x-ray, demo UI). ~10–11.5 FPS at 1024×720, ~3.8 GB RSS, VRAM full (~840 MB) with ~1.1 GB spilled to system memory. Demo playback keeps real time by dropping frames.
- **WineD3D (OpenGL): access violation** before the first frame.
- DXVK 2.x is impossible on this GPU (needs Vulkan 1.3).

## HLAE capture

- `winetricks -q dotnet48` installs .NET 4.8 (stop Steam first: winetricks waits for every Wine process to exit; it leaves the prefix on WinXP, so run `winetricks -q win10` after).
- HLAE 2.192.8 (zip) in `C:\hlae`, `ffmpeg.exe` (BtbN win64 GPL 8.1) in `C:\hlae\ffmpeg\bin`.
- `hlae-launch.sh` starts CS2 through `HLAE.exe -customLoader -noGui` with `AfxHookSource2.dll`; the hook works under Wine and answers `mirv_*` over netcon (`-netconport 2121`).
- `record-clip.sh <player> <startTick> <endTick>` drives netcon: `mirv_cmd addAtTick` starts and ends `mirv_streams record` (screen, 60 fps, `afxFfmpeg` preset) at the exact ticks.
- **Result on the GTX 650:** a 10.06 s highlight (ticks 30973–31617) rendered in **68.6 s** (~6.8× real time, ~8.8 rendered FPS), 602 frames at a steady 60 fps, 1024×720 H.264, 9.3 MB. One-time costs per match: ~90 s CS2 start + demo load, ~5 s per seek.
- Throughput estimate: a match with 6 highlights of ~25 s ≈ 17 min of rendering.

## Still to fix

- The demo playback bar is still drawn (`demo_ui_mode 0` did not hide it) and the demo watermark shows bottom-left; both belong in `subtick.cfg`.
- The window is 1024×720 although `-w 1280 -h 720` is passed; 1080p and lower video settings are untested.
- Audio (`startMovieWav`) is off: the container has no sound device.
