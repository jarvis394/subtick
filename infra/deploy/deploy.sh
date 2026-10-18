#!/usr/bin/env bash
# Deploys the pushed main branch of this clone: backs up Postgres, pulls, rebuilds the stack (the
# migrate service runs migrations first), then waits for the api to answer.
#
#   infra/deploy/deploy.sh
#
# Configuration comes from infra/deploy/.env (DATA_DIR, API_PORT). Backups go to
# $DATA_DIR/backups; the newest $KEEP_BACKUPS (default 14) are kept.
set -euo pipefail
cd "$(dirname "$0")/../.."

compose=(docker compose -f infra/deploy/compose.yml)
setting() { grep -E "^$1=" infra/deploy/.env | tail -1 | cut -d= -f2- || true; }
data_dir=$(setting DATA_DIR)
api_port=$(setting API_PORT)
api_port=${api_port:-53000}
: "${data_dir:?DATA_DIR is not set in infra/deploy/.env}"

# Deploys are pushed commits only: a hand-edited file here would be built in silently.
if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
  echo "Uncommitted changes in $PWD; commit them upstream or stash them first:" >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

if [[ -n $("${compose[@]}" ps -q postgres) ]]; then
  mkdir -p "$data_dir/backups"
  backup="$data_dir/backups/subtick-$(date +%Y%m%d-%H%M%S).sql.gz"
  "${compose[@]}" exec -T postgres pg_dump -U subtick subtick | gzip >"$backup"
  echo "Backed up Postgres to $backup"
  ls -1t "$data_dir"/backups/subtick-*.sql.gz | tail -n +$((${KEEP_BACKUPS:-14} + 1)) | xargs -r rm --
fi

before=$(git rev-parse --short HEAD)
git pull --ff-only --quiet origin main
echo "Deploying $(git log --oneline -1) (was $before)"

"${compose[@]}" up -d --build

migrate=$("${compose[@]}" ps -aq migrate)
if [[ $(docker inspect -f '{{.State.ExitCode}}' "$migrate") != 0 ]]; then
  echo "Migrations failed:" >&2
  docker logs --tail 30 "$migrate" >&2
  exit 1
fi

for _ in $(seq 30); do
  if curl -fsS "http://127.0.0.1:$api_port/api/health" >/dev/null 2>&1; then
    echo "Deployed: the api is up."
    exit 0
  fi
  sleep 2
done
echo "The api didn't answer on :$api_port within a minute:" >&2
"${compose[@]}" logs --tail 30 api >&2
exit 1
