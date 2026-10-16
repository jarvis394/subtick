#!/bin/sh
# Headless Xorg on the GPU, a localhost-only VNC view of it (for watching, or signing in to Steam
# by hand), the bootstrap, then the worker. VNC_PASSWORD protects the view; without it no VNC.
set -e
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
