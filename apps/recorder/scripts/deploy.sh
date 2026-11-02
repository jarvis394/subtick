#!/usr/bin/env bash
# Rebuilds the recorder from the pushed main branch and restarts it once it is between jobs, so
# no clip is cut off mid-capture.
#
#   apps/recorder/scripts/deploy.sh          # waits for the current batch to finish
#   apps/recorder/scripts/deploy.sh --now    # restarts straight away (the batch is retried)
#
# Expects this layout, each part overridable:
#   $RECORDER_HOME/app            this checkout
#   $RECORDER_HOME/recorder.env   RECORDER_ENV_FILE
#   $RECORDER_HOME/prefix         RECORDER_WINE: the Wine prefix, a host folder or a volume name
#                                 (the `subtick-wine` volume when the folder doesn't exist)
#   subtick-cs2                   RECORDER_CS2: the CS2 install volume
#   (none)                        RECORDER_CS2_SERVER: a dedicated-server install for
#                                 CS2_SOURCE=server, mounted read-only at CS2_SERVER_DIR
#                                 (/cs2-server unless recorder.env says otherwise)
# Waiting reads the job queue through the stack's Redis container, RECORDER_REDIS
# (subtick-redis-1); without it the restart doesn't wait.
set -euo pipefail
cd "$(dirname "$0")/../../.."

home=${RECORDER_HOME:-$(dirname "$PWD")}
env_file=${RECORDER_ENV_FILE:-$home/recorder.env}
wine=${RECORDER_WINE:-$([[ -d $home/prefix ]] && echo "$home/prefix" || echo subtick-wine)}
cs2=${RECORDER_CS2:-subtick-cs2}
cs2_server=${RECORDER_CS2_SERVER:-}
name=${RECORDER_CONTAINER:-subtick-recorder}
redis=${RECORDER_REDIS:-subtick-redis-1}
[[ -f $env_file ]] || { echo "No recorder.env at $env_file" >&2; exit 1; }

# Deploys are pushed commits only: a hand-applied hotfix here would be built in silently.
if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
  echo "Uncommitted changes in $PWD; stash them (git stash) or land them upstream first:" >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

git fetch --quiet origin
git checkout --quiet --detach origin/main
echo "Building $(git log --oneline -1)"
# Built while the old container keeps recording.
docker build --quiet -f apps/recorder/Dockerfile -t subtick-recorder . >/dev/null

if [[ ${1:-} != --now ]] && docker inspect "$redis" >/dev/null 2>&1; then
  for i in $(seq 360); do
    active=$(docker exec "$redis" redis-cli llen bull:clip.record:active)
    [[ $active == 0 ]] && break
    ((i == 1)) && echo "Waiting for the current batch to finish (--now to skip)…"
    sleep 10
  done
fi

server_mount=()
if [[ -n $cs2_server ]]; then
  server_dir=$(sed -n 's/^CS2_SERVER_DIR=//p' "$env_file")
  server_mount=(-v "$cs2_server:${server_dir:-/cs2-server}:ro" -e "CS2_SERVER_DIR=${server_dir:-/cs2-server}")
fi

docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --init --restart unless-stopped --name "$name" --runtime nvidia --network host \
  --env-file "$env_file" -v "$cs2:/cs2" -v "$wine:/wine" "${server_mount[@]}" subtick-recorder >/dev/null

# The bootstrap updates the Wine prefix and checks the game files before the worker starts.
for _ in $(seq 60); do
  if docker logs "$name" 2>&1 | grep -q 'recorder worker started'; then
    echo "Deployed: the recorder is taking jobs."
    exit 0
  fi
  if [[ $(docker inspect -f '{{.State.Running}}' "$name") != true ]]; then
    echo "The recorder exited:" >&2
    docker logs --tail 30 "$name" >&2
    exit 1
  fi
  sleep 10
done
echo "The recorder hasn't started its worker after 10 minutes; see docker logs $name" >&2
exit 1
