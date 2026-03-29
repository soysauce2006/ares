#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# build-update-zip.sh — Build A.R.E.S. and package as an uploadable update zip
#
# Usage:
#   bash scripts/build-update-zip.sh
#
# Output:
#   ares-update.zip   (in the project root)
#
# Upload via:
#   A.R.E.S. web UI → Settings → Upload Update Package
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== A.R.E.S. Update Package Builder ==="
echo "Root: $ROOT"
echo ""

cd "$ROOT"

echo "[1/4] Installing dependencies..."
pnpm install --frozen-lockfile

echo ""
echo "[2/4] Building frontend..."
BASE_PATH=/ PORT=3000 NODE_ENV=production \
  pnpm --filter @workspace/roster-app run build

echo ""
echo "[3/4] Building API server..."
pnpm --filter @workspace/api-server run build

echo ""
echo "[4/4] Packaging update zip..."

# Copy frontend into api-server dist
mkdir -p artifacts/api-server/dist/public
cp -r artifacts/roster-app/dist/public/. artifacts/api-server/dist/public/

# Create the zip (structure: dist/index.cjs + dist/public/**)
OUT="$ROOT/ares-update.zip"
rm -f "$OUT"

cd "$ROOT/artifacts/api-server"
zip -r "$OUT" dist/index.cjs dist/public/

echo ""
echo "=== Done! ==="
echo "Update package: $OUT"
echo "Size: $(du -sh "$OUT" | cut -f1)"
echo ""
echo "Upload via: A.R.E.S. web UI → Settings → Upload Update Package"
