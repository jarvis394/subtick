#!/bin/sh
# Starts a headless Xorg on the GPU, plus a localhost-only VNC view of it, then runs the command.
set -e
Xorg :0 -noreset -novtswitch -sharevts -nolisten tcp -logfile /tmp/Xorg.log vt7 &
for _ in $(seq 40); do xdpyinfo >/dev/null 2>&1 && break; sleep 0.5; done
xdpyinfo >/dev/null 2>&1 || { echo "Xorg did not start"; tail -40 /tmp/Xorg.log; exit 1; }
x11vnc -display :0 -localhost -forever -shared -nopw -quiet -bg -o /tmp/x11vnc.log
exec "$@"
