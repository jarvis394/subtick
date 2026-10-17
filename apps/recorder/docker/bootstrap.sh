#!/bin/bash
# Prepares everything the recorder needs before the worker starts. Idempotent: each step checks
# what is already there, so restarts are fast and only the first boot downloads.
#
#   1. Wine prefix: DXVK, .NET 4.8 (HLAE's launcher), HLAE + ffmpeg (with the mirv_pov hook when
#      HLAE_POV=1), the Windows Steam client (STEAM_MODE=client only).
#   2. CS2 game files, from CS2_SOURCE:
#        download  steamcmd installs the Windows build into CS2_DIR (anonymous, ~65 GB) and keeps
#                  it updated on every start. The default.
#        path      CS2_DIR already holds a Windows install (a mounted Steam library or volume).
#        server    CS2_SERVER_DIR holds a Linux dedicated-server install (e.g. a game panel's
#                  volume). Only the Windows binaries (~5 GB) are downloaded; CS2_DIR becomes a
#                  tree of symlinks into the server install plus those binaries. The server is
#                  never written to, and both must be on the same CS2 build.
#   3. STEAM_MODE=emulator: gbe_fork's steam_api64.dll and settings over game/bin/win64, so CS2
#      runs without the Steam client. STEAM_MODE=client puts Steam's own DLL back.
set -euo pipefail

: "${WINEPREFIX:=/wine/pfx}"
: "${CS2_DIR:=/cs2}"
: "${CS2_SOURCE:=download}"
: "${DXVK_VERSION:=2.7.1}"
: "${HLAE_VERSION:=2.192.8}"
: "${STEAMCMD_DIR:=/steamcmd}"
: "${STEAM_MODE:=client}"
: "${HLAE_POV:=0}"
: "${GBE_SETTINGS:=$(dirname "$0")/../gbe/steam_settings}"

log() { echo "[bootstrap] $*"; }
export WINEDEBUG=-all

steamcmd() {
  mkdir -p "$STEAMCMD_DIR"
  if [ ! -x "$STEAMCMD_DIR/steamcmd.sh" ]; then
    curl -fsSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz | tar -xz -C "$STEAMCMD_DIR"
  fi
  "$STEAMCMD_DIR/steamcmd.sh" "$@"
}

# The build id the public branch is on, as steamcmd reports it.
public_build() {
  steamcmd +login anonymous +app_info_update 1 +app_info_print 730 +quit 2>/dev/null |
    awk '/"branches"/{b=1} b&&/"public"/{p=1} p&&/"buildid"/{gsub(/"/,"",$2); print $2; exit}'
}

installed_build() { awk -F'"' '/"buildid"/{print $4; exit}' "$1/steamapps/appmanifest_730.acf" 2>/dev/null; }

setup_prefix() {
  local marker="$WINEPREFIX/.subtick-prefix"
  if [ ! -f "$marker" ]; then
    log "creating Wine prefix (first boot: .NET and Steam take a few minutes)"
    mkdir -p "$WINEPREFIX"
    # No Mono/Gecko: their installers open dialogs that block a headless boot.
    WINEDLLOVERRIDES="mscoree,mshtml=" wineboot -i && wineserver -w
    W_OPT_UNATTENDED=1 winetricks -q --force dotnet48 && wineserver -w
    winetricks -q win10 && wineserver -w
    for d in d3d9 d3d10core d3d11 dxgi; do
      # Steam's CEF crashes on DXVK; it keeps Wine's own D3D.
      wine reg add 'HKCU\Software\Wine\AppDefaults\steamwebhelper.exe\DllOverrides' /v "$d" /d builtin /f >/dev/null
    done
    touch "$marker"
  fi

  # The Steam client only when CS2 talks to it; an emulated Steam needs none.
  if [ "$STEAM_MODE" = client ] && [ ! -f "$WINEPREFIX/drive_c/Program Files (x86)/Steam/steam.exe" ]; then
    log "installing the Steam client"
    curl -fsSLo /tmp/SteamSetup.exe https://cdn.cloudflare.steamstatic.com/client/installer/SteamSetup.exe
    wine /tmp/SteamSetup.exe /S && wineserver -w
  fi

  # DXVK: copied on every version change. Its own setup script predates Wine 11's single binary.
  if [ "$(cat "$WINEPREFIX/.subtick-dxvk" 2>/dev/null)" != "$DXVK_VERSION" ]; then
    [ -d "/opt/dxvk-$DXVK_VERSION" ] || { log "DXVK $DXVK_VERSION is not in the image"; exit 1; }
    log "installing DXVK $DXVK_VERSION"
    local sys="$WINEPREFIX/drive_c/windows"
    for d in d3d9 d3d10core d3d11 dxgi; do
      cp "/opt/dxvk-$DXVK_VERSION/x64/$d.dll" "$sys/system32/"
      cp "/opt/dxvk-$DXVK_VERSION/x32/$d.dll" "$sys/syswow64/"
      wine reg add 'HKCU\Software\Wine\DllOverrides' /v "$d" /d native /f >/dev/null
    done
    wineserver -w
    echo "$DXVK_VERSION" > "$WINEPREFIX/.subtick-dxvk"
  fi

  local hlae="$WINEPREFIX/drive_c/hlae"
  if [ "$(cat "$hlae/.version" 2>/dev/null)" != "$HLAE_VERSION" ]; then
    log "installing HLAE $HLAE_VERSION"
    rm -rf "$hlae" && mkdir -p "$hlae/ffmpeg/bin"
    curl -fsSLo /tmp/hlae.zip "https://github.com/advancedfx/advancedfx/releases/download/v$HLAE_VERSION/hlae_${HLAE_VERSION//./_}.zip"
    unzip -qo /tmp/hlae.zip -d "$hlae"
    curl -fsSLo /tmp/ff.zip https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-gpl-8.1.zip
    rm -rf /tmp/ff && unzip -qo /tmp/ff.zip -d /tmp/ff
    cp /tmp/ff/*/bin/ffmpeg.exe "$hlae/ffmpeg/bin/"
    echo "$HLAE_VERSION" > "$hlae/.version"
  fi
  setup_hlae_pov "$hlae/x64"
}

# HLAE_POV=1: the mirv_pov fork's AfxHookSource2.dll (from the image) over HLAE's own, which is
# kept to switch back. A fresh HLAE install above drops both; the fork is laid over it again.
setup_hlae_pov() {
  local dll="$1/AfxHookSource2.dll" official="$1/AfxHookSource2.official.dll"
  local fork=/opt/hlae-pov/AfxHookSource2.dll
  if [ "$HLAE_POV" = 1 ]; then
    local base
    base=$(cat /opt/hlae-pov/.hlae-version)
    if [ "$base" != "$HLAE_VERSION" ]; then
      log "mirv_pov is built for HLAE $base, not $HLAE_VERSION: keeping HLAE's own hook (spectator HUD)"
      return
    fi
    [ -f "$official" ] || cp "$dll" "$official"
    if ! cmp -s "$fork" "$dll"; then
      log "installing mirv_pov ($(cat /opt/hlae-pov/.release))"
      cp "$fork" "$dll"
    fi
  elif [ -f "$official" ]; then
    log "restoring HLAE's own AfxHookSource2.dll"
    cp "$official" "$dll" && rm "$official"
  fi
}

# STEAM_MODE=emulator: gbe_fork stands in for Steam. Steam's own steam_api64.dll is kept beside it
# (and refreshed when a game update restores it) so STEAM_MODE=client can put it back.
setup_steam_api() {
  local bin="$CS2_DIR/game/bin/win64"
  local dll="$bin/steam_api64.dll" steam="$bin/steam_api64.steam.dll"
  if [ "$STEAM_MODE" = emulator ]; then
    cmp -s /opt/gbe/steam_api64.dll "$dll" || cp "$dll" "$steam"
    if ! cmp -s /opt/gbe/steam_api64.dll "$dll"; then
      log "installing gbe_fork ($(cat /opt/gbe/.release)) in place of Steam"
      cp /opt/gbe/steam_api64.dll "$dll"
    fi
    rm -rf "$bin/steam_settings" && cp -r "$GBE_SETTINGS" "$bin/steam_settings"
    mkdir -p "$bin/gse_saves"
  elif [ -f "$steam" ]; then
    log "restoring Steam's own steam_api64.dll"
    cp "$steam" "$dll" && rm "$steam"
    rm -rf "$bin/steam_settings"
  fi
}

setup_game() {
  case "$CS2_SOURCE" in
    download)
      log "updating CS2 in $CS2_DIR (first download is ~65 GB)"
      steamcmd +@sSteamCmdForcePlatformType windows +force_install_dir "$CS2_DIR" \
        +login anonymous +app_update 730 +quit
      ;;
    path)
      log "using the CS2 install in $CS2_DIR"
      ;;
    server)
      : "${CS2_SERVER_DIR:?CS2_SOURCE=server needs CS2_SERVER_DIR}"
      local server_build public
      server_build=$(installed_build "$CS2_SERVER_DIR")
      public=$(public_build)
      if [ -n "$public" ] && [ "$server_build" != "$public" ]; then
        log "the server in $CS2_SERVER_DIR is on build $server_build, CS2 is on $public: update the server first"
        exit 1
      fi
      local bins="$CS2_DIR/.windows-binaries"
      if [ "$(cat "$bins/.build" 2>/dev/null)" != "$server_build" ]; then
        log "downloading the Windows binaries for build $server_build"
        rm -rf "$bins" && mkdir -p "$bins"
        steamcmd +@sSteamCmdForcePlatformType windows +login anonymous +download_depot 730 2347771 +quit
        cp -r "$STEAMCMD_DIR"/linux32/steamapps/content/app_730/depot_2347771/. "$bins/"
        echo "$server_build" > "$bins/.build"
      fi
      log "linking $CS2_DIR to the server install"
      rm -rf "$CS2_DIR/game"
      cp -rs "$CS2_SERVER_DIR/game" "$CS2_DIR/game"
      # Real copies of the Windows binaries over the links (they replace any same-named file).
      cp -r --remove-destination "$bins/game/." "$CS2_DIR/game/"
      ;;
    *)
      log "unknown CS2_SOURCE '$CS2_SOURCE' (download, path or server)"
      exit 1
      ;;
  esac
  [ -f "$CS2_DIR/game/bin/win64/cs2.exe" ] || { log "no game/bin/win64/cs2.exe in $CS2_DIR"; exit 1; }
  # CS2 refuses to start without SteamAPI; with this file it skips relaunching through Steam.
  echo 730 > "$CS2_DIR/game/bin/win64/steam_appid.txt"
  mkdir -p "$CS2_DIR/game/csgo/subtick"
  setup_steam_api
}

setup_prefix
setup_game
log "ready"
