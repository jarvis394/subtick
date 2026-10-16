# Spike: CS2 (Windows build) + HLAE under Wine on a headless NVIDIA Xorg.
# Proves risk #3 in ARCHITECTURE.md; not the production recorder image yet.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive

RUN dpkg --add-architecture i386 && apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg xz-utils unzip cabextract procps \
      xserver-xorg-core x11-utils x11-xserver-utils xdotool x11vnc xauth \
      libvulkan1 libvulkan1:i386 vulkan-tools mesa-utils winbind \
      fonts-liberation fonts-noto-core fontconfig imagemagick x11-apps \
 && mkdir -pm755 /etc/apt/keyrings \
 && curl -fsSL https://dl.winehq.org/wine-builds/winehq.key | gpg --dearmor -o /etc/apt/keyrings/winehq-archive.key \
 && curl -fsSL -o /etc/apt/sources.list.d/winehq-noble.sources https://dl.winehq.org/wine-builds/ubuntu/dists/noble/winehq-noble.sources \
 && apt-get update && apt-get install -y --install-recommends winehq-stable \
 && curl -fsSL -o /usr/local/bin/winetricks https://raw.githubusercontent.com/Winetricks/winetricks/20250102/src/winetricks \
 && chmod +x /usr/local/bin/winetricks \
 && rm -rf /var/lib/apt/lists/*

# Last DXVK that runs on Vulkan 1.1/1.2 drivers (Kepler, driver 470). 2.x needs Vulkan 1.3.
RUN mkdir -p /opt/dxvk \
 && curl -fsSL https://github.com/doitsujin/dxvk/releases/download/v1.10.3/dxvk-1.10.3.tar.gz \
    | tar -xz -C /opt/dxvk --strip-components=1

COPY xorg.conf /etc/X11/xorg.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY setup-prefix.sh /spike/setup-prefix.sh

ENV NVIDIA_VISIBLE_DEVICES=all NVIDIA_DRIVER_CAPABILITIES=all \
    DISPLAY=:0 WINEPREFIX=/wine/pfx WINEARCH=win64 WINEDEBUG=-all
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["sleep", "infinity"]
