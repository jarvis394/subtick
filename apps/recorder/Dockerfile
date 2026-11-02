# subtick recorder: CS2 (Windows build) + HLAE under Wine on a headless NVIDIA Xorg, driven by the
# clip.record worker. Build from the repo root:
#   docker build -f apps/recorder/Dockerfile -t subtick-recorder .
# Run with the NVIDIA runtime; see apps/recorder/README.md for volumes and environment. On start,
# docker/bootstrap.sh sets up the Wine prefix and the game files, then the worker runs.

# Pinned third-party binaries the bootstrap lays over the game and HLAE when their toggles are on.
# A changed release fails the checksum and the build: bumping one is an edit of version and hash.
FROM alpine:3.20 AS binaries
RUN apk add --no-cache curl 7zip
# gbe_fork (LGPL-3.0, https://github.com/Detanup01/gbe_fork): a Steam API emulator, so CS2 runs
# without the Steam client or an account. Only its regular x64 steam_api64.dll is kept.
ARG GBE_RELEASE=release-2026_09_27
ARG GBE_SHA256=300186c34f49a9ea75b33ce2af299267cc1dad0225cf45e81a229578d4e11c85
RUN curl -fsSLo /tmp/gbe.7z "https://github.com/Detanup01/gbe_fork/releases/download/$GBE_RELEASE/emu-win-release-vs22.7z" \
 && echo "$GBE_SHA256  /tmp/gbe.7z" | sha256sum -c - \
 && 7z x -y -o/tmp/gbe /tmp/gbe.7z >/dev/null \
 && mkdir -p /out/gbe \
 && cp /tmp/gbe/release/regular/x64/steam_api64.dll /tmp/gbe/release/CREDITS.md /out/gbe/ \
 && echo "$GBE_RELEASE" > /out/gbe/.release
# The mirv_pov fork of HLAE's AfxHookSource2.dll (AGPL-3.0, source in the same release:
# https://github.com/WangChuDi/advancedfx), built on HLAE 2.192.8: the player's own HUD in CS2
# demos (HLAE_POV=1). Must match the HLAE_VERSION the bootstrap installs.
ARG HLAE_POV_RELEASE=prerelease-97-7d666a293a730f5d2421665f3605e837322ff545
ARG HLAE_POV_ASSET=AfxHookSource2-7d666a293a73-windows-x64.zip
ARG HLAE_POV_SHA256=0e3fa91e11bbf3720f780d882a1402e9878832a500af57d9b9e6be304a903516
ARG HLAE_POV_HLAE_VERSION=2.192.8
RUN curl -fsSLo /tmp/pov.zip "https://github.com/WangChuDi/advancedfx/releases/download/$HLAE_POV_RELEASE/$HLAE_POV_ASSET" \
 && echo "$HLAE_POV_SHA256  /tmp/pov.zip" | sha256sum -c - \
 && mkdir -p /out/hlae-pov && unzip -q /tmp/pov.zip -d /out/hlae-pov \
 && test -f /out/hlae-pov/AfxHookSource2.dll \
 && echo "$HLAE_POV_RELEASE" > /out/hlae-pov/.release \
 && echo "$HLAE_POV_HLAE_VERSION" > /out/hlae-pov/.hlae-version

FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive

RUN dpkg --add-architecture i386 && apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg xz-utils unzip cabextract procps \
      xserver-xorg-core x11-utils x11-xserver-utils x11vnc xauth \
      libvulkan1 libvulkan1:i386 winbind fonts-liberation fontconfig ffmpeg \
      lib32gcc-s1 lib32stdc++6 pulseaudio \
 && mkdir -pm755 /etc/apt/keyrings \
 && curl -fsSL https://dl.winehq.org/wine-builds/winehq.key | gpg --dearmor -o /etc/apt/keyrings/winehq-archive.key \
 && curl -fsSL -o /etc/apt/sources.list.d/winehq-noble.sources https://dl.winehq.org/wine-builds/ubuntu/dists/noble/winehq-noble.sources \
 # Staging: first picked because wine-stable 11.0 couldn't draw the old Steam client's text
 # (Wine bug 58346); recording is verified on it. Pinned: a new Wine updates the prefix on first
 # launch, and 11.20's update crashes the 32-bit rundll32 behind a modal dialog, so CS2 never starts.
 && WINE=11.19~noble-1 \
 && apt-get update && apt-get install -y --install-recommends winehq-staging=$WINE \
      wine-staging=$WINE wine-staging-amd64=$WINE wine-staging-i386:i386=$WINE \
 && curl -fsSL -o /usr/local/bin/winetricks https://raw.githubusercontent.com/Winetricks/winetricks/20250102/src/winetricks \
 && chmod +x /usr/local/bin/winetricks \
 && rm -rf /var/lib/apt/lists/*

# DXVK 1.10.3 runs on Vulkan 1.1/1.2 drivers (e.g. Kepler on driver 470); 2.x needs Vulkan 1.3.
RUN for v in 1.10.3 2.7.1; do \
      mkdir -p /opt/dxvk-$v && curl -fsSL https://github.com/doitsujin/dxvk/releases/download/v$v/dxvk-$v.tar.gz \
        | tar -xz -C /opt/dxvk-$v --strip-components=1; \
    done

COPY --from=binaries /out/gbe /opt/gbe
COPY --from=binaries /out/hlae-pov /opt/hlae-pov

COPY --from=oven/bun:1.3.14 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --production --filter '@subtick/recorder-worker'

COPY apps/recorder/docker/xorg.conf /etc/X11/xorg.conf
ENV NVIDIA_VISIBLE_DEVICES=all NVIDIA_DRIVER_CAPABILITIES=all \
    DISPLAY=:0 WINEPREFIX=/wine/pfx WINEDEBUG=-all PULSE_SERVER=unix:/tmp/pulse.sock
ENTRYPOINT ["/app/apps/recorder/docker/entrypoint.sh"]
CMD ["bun", "apps/recorder/src/main.ts"]
