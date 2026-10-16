#!/bin/bash
# Spike driver: records one demo window through HLAE over CS2 netcon and timestamps the console.
# usage: record-clip.sh <player> <startTick> <endTick>
player=$1 start=$2 end=$3
log=~/subtick-recorder/record-$start.log
exec 3<>/dev/tcp/127.0.0.1/2121
( while IFS= read -r line <&3; do printf "%s %s\n" "$(date +%s.%N | cut -c1-14)" "$line"; done ) > "$log" &
reader=$!
send() { printf "%s\n" "$1" >&3; }
send "demo_ui_mode 0"
send "demo_pause"
send "mirv_streams record screen enabled 1"
send "mirv_streams record fps 60"
send "mirv_streams record startMovieWav 0"
send "mirv_streams record name \"C:\\out\""
send "mirv_streams settings edit afxDefault settings afxFfmpeg"
send "mirv_cmd clear"
send "mirv_cmd addAtTick $((start - 32)) \"spec_player $player\""
send "mirv_cmd addAtTick $start \"echo SUBTICK_START; mirv_streams record start\""
send "mirv_cmd addAtTick $end \"mirv_streams record end; demo_pause; echo SUBTICK_DONE\""
send "demo_gototick $((start - 128))"
sleep 5
send "spec_player $player"
send "demo_resume"
for _ in $(seq 1800); do grep -q SUBTICK_DONE "$log" && break; sleep 1; done
sleep 3; kill $reader; exec 3>&-
s=$(grep -m1 SUBTICK_START "$log" | cut -d" " -f1); e=$(grep -m1 SUBTICK_DONE "$log" | cut -d" " -f1)
echo "clip ticks $start-$end ($(( (end-start) * 1000 / 64 )) ms of demo) rendered in $(echo "$e - $s" | bc) s"
