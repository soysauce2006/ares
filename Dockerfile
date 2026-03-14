FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Dependency layer ───────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json lib/db/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/roster-app/package.json artifacts/roster-app/
COPY scripts/package.json scripts/
# Stub the mobile app so pnpm resolves the workspace without pulling in Expo
RUN mkdir -p artifacts/ares-mobile && printf '{"name":"@workspace/ares-mobile","version":"0.0.0","private":true}' > artifacts/ares-mobile/package.json
# --no-frozen-lockfile lets pnpm reconcile the stub (no Expo deps) with the
# lockfile; all other packages still install at their locked versions.
RUN pnpm install --no-frozen-lockfile

# ── Build layer ────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
# Restore the stub — COPY . . overwrites with the real package.json; re-stub it
# so pnpm does not attempt to install Expo inside the Docker image
RUN printf '{"name":"@workspace/ares-mobile","version":"0.0.0","private":true}' > artifacts/ares-mobile/package.json
# Build frontend (BASE_PATH=/ for single-origin deployment)
RUN BASE_PATH=/ PORT=3000 pnpm --filter @workspace/roster-app run build
# Build API server
RUN pnpm --filter @workspace/api-server run build
# Bundle frontend into API server dist so a single process serves everything
RUN mkdir -p artifacts/api-server/dist/public && cp -r artifacts/roster-app/dist/public/. artifacts/api-server/dist/public/

# ── Production runner ──────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
RUN apk add --no-cache postgresql-client
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 ares && adduser --system --uid 1001 ares

COPY --from=builder --chown=ares:ares /app/node_modules ./node_modules
COPY --from=builder --chown=ares:ares /app/artifacts/api-server/dist ./dist
# Migration SQL (applied once at container startup via entrypoint)
COPY --chown=ares:ares lib/db/drizzle/0000_military_molten_man.sql /app/migrations/0000_initial_schema.sql
# Startup entrypoint
COPY --chown=ares:ares docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER ares

EXPOSE 8080
ENV PORT=8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
