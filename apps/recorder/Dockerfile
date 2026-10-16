# subtick recorder: CS2 (Windows build) + HLAE under Wine on a headless NVIDIA Xorg, driven by the
# clip.record worker. Build from the repo root:
#   docker build -f apps/recorder/Dockerfile -t subtick-recorder .
# Run with the NVIDIA runtime; see apps/recorder/README.md for volumes and environment. On start,
# docker/bootstrap.sh sets up the Wine prefix and the game files, then the worker runs.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive

RUN dpkg --add-architecture i386 && apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg xz-utils unzip cabextract procps \
      xserver-xorg-core x11-utils x11-xserver-utils xdotool x11vnc xauth imagemagick \
      libvulkan1 libvulkan1:i386 winbind fonts-liberation fontconfig ffmpeg \
      lib32gcc-s1 lib32stdc++6 pulseaudio \
 && mkdir -pm755 /etc/apt/keyrings \
 && curl -fsSL https://dl.winehq.org/wine-builds/winehq.key | gpg --dearmor -o /etc/apt/keyrings/winehq-archive.key \
 && curl -fsSL -o /etc/apt/sources.list.d/winehq-noble.sources https://dl.winehq.org/wine-builds/ubuntu/dists/noble/winehq-noble.sources \
 # Staging: wine-stable 11.0 can't draw the Steam client's text (Wine bug 58346).
 && apt-get update && apt-get install -y --install-recommends winehq-staging \
 && curl -fsSL -o /usr/local/bin/winetricks https://raw.githubusercontent.com/Winetricks/winetricks/20250102/src/winetricks \
 && chmod +x /usr/local/bin/winetricks \
 && rm -rf /var/lib/apt/lists/*

# DXVK 1.10.3 runs on Vulkan 1.1/1.2 drivers (e.g. Kepler on driver 470); 2.x needs Vulkan 1.3.
RUN for v in 1.10.3 2.7.1; do \
      mkdir -p /opt/dxvk-$v && curl -fsSL https://github.com/doitsujin/dxvk/releases/download/v$v/dxvk-$v.tar.gz \
        | tar -xz -C /opt/dxvk-$v --strip-components=1; \
    done

COPY --from=oven/bun:1.3.14 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --production --filter '@subtick/recorder-worker'

COPY apps/recorder/docker/xorg.conf /etc/X11/xorg.conf
ENV NVIDIA_VISIBLE_DEVICES=all NVIDIA_DRIVER_CAPABILITIES=all \
    DISPLAY=:0 WINEPREFIX=/wine/pfx WINEDEBUG=-all PULSE_SERVER=unix:/tmp/pulse.sock
ENTRYPOINT ["/app/apps/recorder/docker/entrypoint.sh"]
CMD ["bun", "apps/recorder/src/main.ts"]
