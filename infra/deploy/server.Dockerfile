# api, parser and steam worker share one image; compose picks the entry point. Build from the
# repo root: docker build -f infra/deploy/server.Dockerfile -t subtick-server .
FROM oven/bun:1.3.14-slim
# The steam worker shells out to bunzip2 for Valve's .dem.bz2 replays.
RUN apt-get update && apt-get install -y --no-install-recommends bzip2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --production \
      --filter '@subtick/api' --filter '@subtick/parser' --filter '@subtick/steam-worker' \
      --filter '@subtick/db'
ENV NODE_ENV=production LOG_FORMAT=json SCRATCH_DIR=/data
