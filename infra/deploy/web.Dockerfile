# Static build of the web app behind nginx. /api is routed to the api by the reverse proxy in
# front (Traefik on the homelab). Build from the repo root:
#   docker build -f infra/deploy/web.Dockerfile -t subtick-web .
FROM oven/bun:1.3.14 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --filter '@subtick/web' && bun run --cwd apps/web build

FROM nginx:1.29-alpine
COPY infra/deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
