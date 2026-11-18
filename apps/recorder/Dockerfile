# subtick recorder: CS2 (Windows build) + HLAE under Wine on a headless NVIDIA Xorg, driven by the
# clip.record worker. Published as ghcr.io/jarvis394/subtick-recorder; to build it, from the repo root:
#   docker build -f apps/recorder/Dockerfile -t subtick-recorder .
# Run with the NVIDIA runtime (docker/compose.yml); see apps/recorder/README.md. On start,
# docker/bootstrap.sh sets up the Wine prefix and the game files, then `subtick-recorder run`.

# Pinned third-party binaries the bootstrap lays over the game and HLAE when their toggles are on.
# The pins live in pins.json, shared with the Windows `setup`: bumping one is an edit there, and a
# changed release fails the checksum and the build.
FROM alpine:3.20 AS binaries
RUN apk add --no-cache curl 7zip jq
COPY apps/recorder/pins.json /pins.json
# gbe_fork (LGPL-3.0, https://github.com/Detanup01/gbe_fork): a Steam API emulator, so CS2 runs
# without the Steam client or an account. Only its regular x64 steam_api64.dll is kept.
RUN release=$(jq -r .gbe.release /pins.json) \
 && curl -fsSLo /tmp/gbe.7z "https://github.com/Detanup01/gbe_fork/releases/download/$release/$(jq -r .gbe.asset /pins.json)" \
 && echo "$(jq -r .gbe.sha256 /pins.json)  /tmp/gbe.7z" | sha256sum -c - \
 && 7z x -y -o/tmp/gbe /tmp/gbe.7z >/dev/null \
 && mkdir -p /out/gbe \
 && cp /tmp/gbe/release/regular/x64/steam_api64.dll /tmp/gbe/release/CREDITS.md /out/gbe/ \
 && echo "$release" > /out/gbe/.release
# The mirv_pov fork of HLAE's AfxHookSource2.dll (AGPL-3.0, source in the same release:
# https://github.com/WangChuDi/advancedfx): the player's own HUD in CS2 demos (HLAE_POV=1). Built
# on the HLAE version the bootstrap installs by default.
RUN release=$(jq -r .hlaePov.release /pins.json) \
 && curl -fsSLo /tmp/pov.zip "https://github.com/WangChuDi/advancedfx/releases/download/$release/$(jq -r .hlaePov.asset /pins.json)" \
 && echo "$(jq -r .hlaePov.sha256 /pins.json)  /tmp/pov.zip" | sha256sum -c - \
 && mkdir -p /out/hlae-pov && unzip -q /tmp/pov.zip -d /out/hlae-pov \
 && test -f /out/hlae-pov/AfxHookSource2.dll \
 && echo "$release" > /out/hlae-pov/.release \
 && jq -r .hlaePov.hlaeVersion /pins.json > /out/hlae-pov/.hlae-version \
 && jq -r .hlae.version /pins.json > /out/hlae-version

# The worker: the same subtick-recorder executable as the Windows release, built for Linux.
FROM oven/bun:1.4.4 AS worker
ARG VERSION
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --filter '@subtick/recorder-worker' \
 && VERSION=${VERSION:-} bun apps/recorder/scripts/compile.ts linux

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
COPY --from=binaries /out/hlae-version /opt/hlae-version

COPY --from=worker /app/apps/recorder/dist/subtick-recorder-linux-x64 /usr/local/bin/subtick-recorder
WORKDIR /app
COPY apps/recorder/docker apps/recorder/docker
COPY apps/recorder/gbe apps/recorder/gbe

COPY apps/recorder/docker/xorg.conf /etc/X11/xorg.conf
ENV NVIDIA_VISIBLE_DEVICES=all NVIDIA_DRIVER_CAPABILITIES=all \
    DISPLAY=:0 WINEPREFIX=/wine/pfx WINEDEBUG=-all PULSE_SERVER=unix:/tmp/pulse.sock
# DXVK compiles CS2's shaders into Vulkan pipelines on the CPU, slowing capture several times over
# until warm. The driver's cache keeps them across restarts on the /wine volume; 1 GB is too small.
ENV __GL_SHADER_DISK_CACHE_PATH=/wine/shader-cache __GL_SHADER_DISK_CACHE_SIZE=10737418240 \
    __GL_SHADER_DISK_CACHE_SKIP_CLEANUP=1
# `docker run <image> doctor` (or smoke, version) runs another command after the same bootstrap.
ENTRYPOINT ["/app/apps/recorder/docker/entrypoint.sh", "subtick-recorder"]
CMD ["run"]
