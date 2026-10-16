#!/bin/sh
# Builds the Wine prefix inside the spike container: DXVK 1.10.3 for CS2, Steam for SteamAPI.
# Run once: docker exec subtick-cs2-spike /spike/setup-prefix.sh
set -e
P="$WINEPREFIX/drive_c/windows"
mkdir -p "$WINEPREFIX"

# No Mono/Gecko: their installers open dialogs that block a headless wineboot.
WINEDLLOVERRIDES="mscoree,mshtml=" wineboot -i
wineserver -w

# DXVK 1.10.3's setup script looks for a `wine64` binary that Wine 11 no longer ships and
# installs 32-bit DLLs into system32, so copy them by hand.
for d in d3d9 d3d10core d3d11 dxgi; do
  cp "/opt/dxvk/x64/$d.dll" "$P/system32/"
  cp "/opt/dxvk/x32/$d.dll" "$P/syswow64/"
  wine reg add 'HKCU\Software\Wine\DllOverrides' /v "$d" /d native /f
  # Steam's CEF crashes on DXVK; it gets Wine's own D3D.
  wine reg add 'HKCU\Software\Wine\AppDefaults\steamwebhelper.exe\DllOverrides' /v "$d" /d builtin /f
done
wineserver -w

curl -fsSLo /tmp/SteamSetup.exe https://cdn.cloudflare.steamstatic.com/client/installer/SteamSetup.exe
wine /tmp/SteamSetup.exe /S
wineserver -w

# HLAE's launcher is .NET Framework. winetricks leaves the prefix on WinXP; Steam needs Win10.
W_OPT_UNATTENDED=1 winetricks -q --force dotnet48
winetricks -q win10
H="$WINEPREFIX/drive_c/hlae"
mkdir -p "$H/ffmpeg/bin"
curl -fsSLo /tmp/hlae.zip https://github.com/advancedfx/advancedfx/releases/download/v2.192.8/hlae_2_192_8.zip
unzip -qo /tmp/hlae.zip -d "$H"
curl -fsSLo /tmp/ff.zip https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-gpl-8.1.zip
unzip -qo /tmp/ff.zip -d /tmp/ff
cp /tmp/ff/*/bin/ffmpeg.exe "$H/ffmpeg/bin/"
mkdir -p "$WINEPREFIX/drive_c/out"

# CS2 refuses to start without SteamAPI; with this file it skips relaunching through Steam.
echo 730 > /cs2/game/bin/win64/steam_appid.txt
echo "prefix ready: start Steam, sign in once over VNC (remember me), then launch cs2.exe"
