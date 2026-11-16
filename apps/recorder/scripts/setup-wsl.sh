#!/usr/bin/env bash
# Sets up a recorder whose worker runs in WSL and whose game runs on Windows itself
# (GAME_HOST=windows): no Docker, Wine or Xorg, and the real GPU driver. Idempotent; run it again
# after a CS2 update or to change HLAE_VERSION. Needs no sudo.
#
#   CS2_INSTALL="/mnt/c/.../Counter-Strike Global Offensive" apps/recorder/scripts/setup-wsl.sh
#
#   1. HLAE and its ffmpeg.exe in WINDOWS_DIR/hlae, and with HLAE_POV=1 the mirv_pov fork of its
#      hook over HLAE's own (kept as AfxHookSource2.official.dll to switch back).
#   2. CS2_DIR: a copy of the install's game/bin (where gbe_fork replaces Steam's DLL) and
#      junctions to the rest of it, so the install Steam knows stays as it is. The one thing
#      written there is game/csgo/subtick, where demos are copied for playback.
#   3. ffmpeg and ffprobe for the worker's own encoding, when the distro has none.
set -euo pipefail

: "${CS2_INSTALL:?set CS2_INSTALL to the Windows CS2 install (the folder that holds game/)}"
: "${WINDOWS_DIR:=/mnt/c/subtick}"
: "${CS2_DIR:=$WINDOWS_DIR/cs2}"
: "${HLAE_VERSION:=2.193.0}"
: "${FFMPEG_DIR:=$HOME/.local/share/subtick-recorder/ffmpeg}"
: "${HLAE_POV:=0}"
# Same pins as the Dockerfile.
GBE_RELEASE=release-2026_09_27
GBE_SHA256=300186c34f49a9ea75b33ce2af299267cc1dad0225cf45e81a229578d4e11c85
HLAE_POV_RELEASE=prerelease-103-b8e51e77933dfc11bab1d2a3a4fde16ab36f03b5
HLAE_POV_ASSET=AfxHookSource2-b8e51e77933d-windows-x64.zip
HLAE_POV_SHA256=65eb85d70be9c1ea02bc54344550ebceaa6040a3f2722470672824a9932315fe
HLAE_POV_HLAE_VERSION=2.193.0

here=$(cd "$(dirname "$0")" && pwd)
system32=/mnt/c/Windows/System32
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

log() { echo "[setup] $*"; }

[ -f "$CS2_INSTALL/game/bin/win64/cs2.exe" ] || { log "no game/bin/win64/cs2.exe in $CS2_INSTALL"; exit 1; }
mkdir -p "$WINDOWS_DIR" "$CS2_DIR/game"

hlae="$WINDOWS_DIR/hlae"
if [ "$(cat "$hlae/.version" 2>/dev/null)" != "$HLAE_VERSION" ]; then
  log "installing HLAE $HLAE_VERSION"
  rm -rf "$hlae" && mkdir -p "$hlae/ffmpeg/bin"
  curl -fsSLo "$tmp/hlae.zip" "https://github.com/advancedfx/advancedfx/releases/download/v$HLAE_VERSION/hlae_${HLAE_VERSION//./_}.zip"
  unzip -qo "$tmp/hlae.zip" -d "$hlae"
  curl -fsSLo "$tmp/ff.zip" https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-gpl-8.1.zip
  unzip -qo "$tmp/ff.zip" -d "$tmp/ff"
  cp "$tmp"/ff/*/bin/ffmpeg.exe "$hlae/ffmpeg/bin/"
  echo "$HLAE_VERSION" > "$hlae/.version"
fi

pov=0
hook="$hlae/x64/AfxHookSource2.dll" official="$hlae/x64/AfxHookSource2.official.dll"
if [ "$HLAE_POV" = 1 ]; then
  if [ "$HLAE_POV_HLAE_VERSION" != "$HLAE_VERSION" ]; then
    log "mirv_pov is built for HLAE $HLAE_POV_HLAE_VERSION, not $HLAE_VERSION: keeping HLAE's own hook (spectator HUD)"
    rm -f "$hlae/.pov-release"
  else
    fork="$WINDOWS_DIR/hlae-pov"
    if [ "$(cat "$fork/.release" 2>/dev/null)" != "$HLAE_POV_RELEASE" ]; then
      log "downloading mirv_pov $HLAE_POV_RELEASE"
      rm -rf "$fork" && mkdir -p "$fork"
      curl -fsSLo "$tmp/pov.zip" "https://github.com/WangChuDi/advancedfx/releases/download/$HLAE_POV_RELEASE/$HLAE_POV_ASSET"
      echo "$HLAE_POV_SHA256  $tmp/pov.zip" | sha256sum -c - >/dev/null
      unzip -qo "$tmp/pov.zip" -d "$fork"
      [ -f "$fork/AfxHookSource2.dll" ] || { log "no AfxHookSource2.dll in $HLAE_POV_ASSET"; exit 1; }
      echo "$HLAE_POV_RELEASE" > "$fork/.release"
    fi
    [ -f "$official" ] || cp "$hook" "$official"
    if ! cmp -s "$fork/AfxHookSource2.dll" "$hook"; then
      log "installing mirv_pov ($HLAE_POV_RELEASE)"
      cp "$fork/AfxHookSource2.dll" "$hook"
    fi
    echo "$HLAE_POV_RELEASE" > "$hlae/.pov-release"
    pov=1
  fi
elif [ -f "$official" ]; then
  log "restoring HLAE's own AfxHookSource2.dll"
  cp "$official" "$hook" && rm -f "$official" "$hlae/.pov-release"
fi

gbe="$WINDOWS_DIR/gbe"
if [ "$(cat "$gbe/.release" 2>/dev/null)" != "$GBE_RELEASE" ]; then
  log "downloading gbe_fork $GBE_RELEASE"
  rm -rf "$gbe" && mkdir -p "$gbe"
  curl -fsSLo "$gbe/gbe.7z" "https://github.com/Detanup01/gbe_fork/releases/download/$GBE_RELEASE/emu-win-release-vs22.7z"
  echo "$GBE_SHA256  $gbe/gbe.7z" | sha256sum -c - >/dev/null
  # Windows' own tar reads 7z; the distro may have nothing that does.
  (cd "$gbe" && "$system32/tar.exe" -xf gbe.7z release/regular/x64/steam_api64.dll)
  mv "$gbe/release/regular/x64/steam_api64.dll" "$gbe/" && rm -rf "$gbe/release" "$gbe/gbe.7z"
  echo "$GBE_RELEASE" > "$gbe/.release"
fi

build=$(sha256sum "$CS2_INSTALL/game/csgo/steam.inf" | cut -d' ' -f1)
if [ "$(cat "$CS2_DIR/.build" 2>/dev/null)" != "$build" ]; then
  log "copying game/bin from $CS2_INSTALL"
  # Only ever the copy: everything else in game/ is a junction into the install.
  rm -rf "$CS2_DIR/game/bin"
  cp -r "$CS2_INSTALL/game/bin" "$CS2_DIR/game/bin"
  echo "$build" > "$CS2_DIR/.build"
fi

quote() { printf "'%s'" "${1//\'/\'\'}"; }
for dir in "$CS2_INSTALL"/game/*/; do
  name=$(basename "$dir")
  [ "$name" = bin ] || [ -e "$CS2_DIR/game/$name" ] && continue
  log "linking game/$name"
  (cd "$WINDOWS_DIR" && "$system32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -Command \
    "New-Item -ItemType Junction -Path $(quote "$(wslpath -w "$CS2_DIR/game")\\$name") -Target $(quote "$(wslpath -w "${dir%/}")") | Out-Null")
done

bin="$CS2_DIR/game/bin/win64"
if ! cmp -s "$gbe/steam_api64.dll" "$bin/steam_api64.dll"; then
  log "installing gbe_fork ($GBE_RELEASE) in place of Steam"
  cp "$gbe/steam_api64.dll" "$bin/steam_api64.dll"
fi
rm -rf "$bin/steam_settings" && cp -r "$here/../gbe/steam_settings" "$bin/steam_settings"
mkdir -p "$bin/gse_saves" "$CS2_DIR/game/csgo/subtick"
# CS2 refuses to start without SteamAPI; with this file it skips relaunching through Steam.
echo 730 > "$bin/steam_appid.txt"

if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
  if [ ! -x "$FFMPEG_DIR/ffmpeg" ]; then
    log "downloading ffmpeg for the worker"
    mkdir -p "$FFMPEG_DIR"
    curl -fsSL https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-linux64-gpl-8.1.tar.xz |
      tar -xJ -C "$FFMPEG_DIR" --strip-components=2 --wildcards '*/bin/ffmpeg' '*/bin/ffprobe'
  fi
  log "the distro has no ffmpeg: start the worker with PATH=$FFMPEG_DIR:\$PATH"
fi

log "ready. In the recorder's environment:"
log "  GAME_HOST=windows"
log "  WINDOWS_DIR=$WINDOWS_DIR"
log "  CS2_DIR=$CS2_DIR"
[ "$pov" = 0 ] || log "  HLAE_POV=1"
