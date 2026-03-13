#!/bin/bash
set -e

echo "=== A.R.E.S. Production Build ==="

echo "[1/3] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[2/3] Building frontend..."
BASE_PATH=/ PORT=3000 pnpm --filter @workspace/roster-app run build

echo "[3/3] Building API server..."
pnpm --filter @workspace/api-server run build

echo "Copying frontend assets into API server dist..."
mkdir -p artifacts/api-server/dist/public
cp -r artifacts/roster-app/dist/public/. artifacts/api-server/dist/public/

echo "=== Build complete ==="
echo "  API server:  artifacts/api-server/dist/index.cjs"
echo "  Frontend:    artifacts/api-server/dist/public/"
