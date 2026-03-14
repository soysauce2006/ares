FROM node:24-slim AS base
# Pin pnpm to the exact version used to generate pnpm-lock.yaml
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
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
# Stub the mobile app — pnpm must know about it (it's in the workspace) but we
# don't want to pull in hundreds of Expo packages.
RUN mkdir -p artifacts/ares-mobile && \
    printf '{"name":"@workspace/ares-mobile","version":"0.0.0","private":true}' \
    > artifacts/ares-mobile/package.json
RUN pnpm install --no-frozen-lockfile

# ── Build layer ────────────────────────────────────────────────────────────────
FROM deps AS builder
# Copy only the source that the server-side build needs.
# We intentionally skip artifacts/ares-mobile and the root lockfile so the
# stub package.json and reconciled node_modules from the deps stage are kept.
COPY tsconfig.json tsconfig.base.json ./
COPY lib/ lib/
COPY scripts/ scripts/
COPY artifacts/api-server/ artifacts/api-server/
COPY artifacts/roster-app/ artifacts/roster-app/

# Build frontend (BASE_PATH=/ for single-origin deployment)
RUN BASE_PATH=/ PORT=3000 NODE_ENV=production \
    pnpm --filter @workspace/roster-app run build
# Build API server
RUN pnpm --filter @workspace/api-server run build
# Bundle frontend into API server dist so a single process serves everything
RUN mkdir -p artifacts/api-server/dist/public && \
    cp -r artifacts/roster-app/dist/public/. artifacts/api-server/dist/public/

# ── Production runner ──────────────────────────────────────────────────────────
FROM node:24-slim AS runner
RUN apt-get update -qq && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system --gid 1001 ares && \
    useradd --system --uid 1001 --gid 1001 ares

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
