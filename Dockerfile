FROM node:24-slim AS base
# Install pnpm via npm (no corepack, no network quirks)
RUN npm install -g pnpm@10.26.1
WORKDIR /app

# ── Dependency layer ───────────────────────────────────────────────────────────
FROM base AS deps
# Copy every package.json so pnpm can resolve the full workspace lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json            lib/db/
COPY lib/api-spec/package.json      lib/api-spec/
COPY lib/api-zod/package.json       lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY artifacts/api-server/package.json  artifacts/api-server/
COPY artifacts/roster-app/package.json  artifacts/roster-app/
COPY artifacts/ares-mobile/package.json artifacts/ares-mobile/
COPY scripts/package.json           scripts/
# Frozen install — lockfile matches all package.json files exactly
RUN pnpm install --frozen-lockfile

# ── Build layer ────────────────────────────────────────────────────────────────
FROM deps AS builder
# Root TypeScript config (both tsconfigs extend this)
COPY tsconfig.json tsconfig.base.json ./
# Library source (db, api-spec, api-zod, api-client-react)
COPY lib/ lib/
# Build scripts
COPY scripts/ scripts/
# Application source — ares-mobile is intentionally omitted (not needed for server build)
COPY artifacts/api-server/  artifacts/api-server/
COPY artifacts/roster-app/  artifacts/roster-app/

# Build frontend (BASE_PATH=/ for single-origin deployment)
RUN BASE_PATH=/ PORT=3000 NODE_ENV=production \
    pnpm --filter @workspace/roster-app run build

# Build API server
RUN pnpm --filter @workspace/api-server run build

# Bundle the compiled frontend into the API server's dist
RUN mkdir -p artifacts/api-server/dist/public && \
    cp -r artifacts/roster-app/dist/public/. artifacts/api-server/dist/public/

# Create a lean production deployment: strips devDeps + Expo + unused workspace packages
# --legacy is required by pnpm v10 when workspace packages are not injected
RUN pnpm --filter @workspace/api-server deploy --prod --legacy /deploy

# ── Production runner ──────────────────────────────────────────────────────────
FROM node:24-slim AS runner
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends postgresql-client && \
    rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system --gid 1001 ares && \
    useradd  --system --uid 1001 --gid 1001 ares

# Production node_modules (no Expo, no devDeps — courtesy of pnpm deploy)
COPY --from=builder --chown=ares:ares /deploy/node_modules ./node_modules
# Compiled API server (includes bundled frontend in dist/public/)
COPY --from=builder --chown=ares:ares /app/artifacts/api-server/dist ./dist
# Migration SQL applied once at container startup
COPY --chown=ares:ares lib/db/drizzle/0000_military_molten_man.sql \
     /app/migrations/0000_initial_schema.sql
# Startup entrypoint
COPY --chown=ares:ares docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER ares
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["/app/docker-entrypoint.sh"]
