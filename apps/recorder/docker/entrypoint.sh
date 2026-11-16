#!/bin/sh
# Headless Xorg on the GPU, a localhost-only VNC view of it (for watching the game), the
# bootstrap, then the worker. VNC_PASSWORD protects the view; without it no VNC.
set -e
# A restarted container keeps /tmp: Xorg refuses to start while the old server's lock is there,
# and PulseAudio while its old pid file and socket are.
rm -rf /tmp/.X0-lock /tmp/.X11-unix /tmp/pulse.sock /tmp/pulse-* /tmp/.wine-* /root/.config/pulse/*-runtime
# Xorg needs the GPU's PCI address. nvidia-smi prints it in hex (00000000:01:00.0), Xorg wants
# decimal (PCI:1:0:0, or PCI:bus@domain:device:function off domain 0). XORG_BUSID overrides it.
xorg_busid() {
  IFS=':.' read -r domain bus device function <<EOF
$1
EOF
  [ -n "$function" ] || return 1
  if [ "$((0x$domain))" -eq 0 ]; then
    printf 'PCI:%d:%d:%d' "0x$bus" "0x$device" "0x$function"
  else
    printf 'PCI:%d@%d:%d:%d' "0x$bus" "0x$domain" "0x$device" "0x$function"
  fi
}
if [ -z "${XORG_BUSID:-}" ]; then
  XORG_BUSID=$(xorg_busid "$(nvidia-smi --query-gpu=pci.bus_id --format=csv,noheader 2>/dev/null | head -1)") ||
    XORG_BUSID=
fi
if [ -n "$XORG_BUSID" ]; then
  sed -i "s/^\( *BusID \).*/\1\"$XORG_BUSID\"/" /etc/X11/xorg.conf
else
  echo "nvidia-smi found no GPU; Xorg uses the BusID in /etc/X11/xorg.conf"
fi
Xorg :0 -noreset -novtswitch -sharevts -nolisten tcp -logfile /tmp/Xorg.log vt7 &
for _ in $(seq 40); do xdpyinfo >/dev/null 2>&1 && break; sleep 0.5; done
xdpyinfo >/dev/null 2>&1 || { echo "Xorg did not start"; tail -40 /tmp/Xorg.log; exit 1; }
# A null audio sink: CS2's sound engine needs an output device to run, and HLAE records the
# game's mix to WAV from inside the engine, so nothing has to be heard.
pulseaudio --daemonize=yes --exit-idle-time=-1 --disallow-exit -n \
  --load="module-native-protocol-unix socket=/tmp/pulse.sock auth-anonymous=1" \
  --load="module-null-sink sink_name=subtick" 2>/dev/null
if [ -n "$VNC_PASSWORD" ]; then
  x11vnc -storepasswd "$VNC_PASSWORD" /tmp/vncpass >/dev/null
  x11vnc -display :0 -localhost -forever -shared -rfbauth /tmp/vncpass -quiet -bg -o /tmp/x11vnc.log
fi
"$(dirname "$0")/bootstrap.sh"
exec "$@"
