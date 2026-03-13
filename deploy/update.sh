#!/bin/bash
# A.R.E.S. — Git Update Script
# Run on the server to pull the latest code, rebuild, migrate, and restart.
# Usage:
#   sudo bash /opt/ares/update.sh                    (uses GIT_REPO from /opt/ares/.env)
#   sudo bash /opt/ares/update.sh https://github.com/you/repo.git
set -e

INSTALL_DIR="/opt/ares"
SERVICE_NAME="ares"
BUILD_DIR="/tmp/ares-build-$$"

echo "╔══════════════════════════════════════════╗"
echo "║   A.R.E.S.  —  Git Update                ║"
echo "╚══════════════════════════════════════════╝"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "[ERROR] Please run as root (sudo bash update.sh)"
  exit 1
fi

# ── Load config ───────────────────────────────────────────────────────────────
if [ -f "$INSTALL_DIR/.env" ]; then
  set -a; source "$INSTALL_DIR/.env"; set +a
fi

GIT_REPO="${1:-$GIT_REPO}"
GIT_BRANCH="${GIT_BRANCH:-main}"

if [ -z "$GIT_REPO" ]; then
  echo "[ERROR] No git repository configured."
  echo "        Set GIT_REPO in $INSTALL_DIR/.env or pass it as an argument:"
  echo "        sudo bash update.sh https://github.com/you/repo.git"
  exit 1
fi

echo "  Repository : $GIT_REPO"
echo "  Branch     : $GIT_BRANCH"
echo "  Install dir: $INSTALL_DIR"
echo ""

# ── Step 1: Ensure build tools are present ────────────────────────────────────
echo "[1/6] Checking build tools..."

if ! command -v node &>/dev/null; then
  echo "      Installing Node.js 24..."
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pnpm &>/dev/null; then
  echo "      Installing pnpm..."
  corepack enable
  corepack prepare pnpm@latest --activate
fi

echo "      Node.js $(node -v) | pnpm $(pnpm -v)"

# ── Step 2: Clone repo into a temp build directory ───────────────────────────
echo "[2/6] Fetching latest code from git..."
rm -rf "$BUILD_DIR"
git clone --depth=1 --branch "$GIT_BRANCH" "$GIT_REPO" "$BUILD_DIR"
echo "      Cloned branch '$GIT_BRANCH' → $BUILD_DIR"

# ── Step 3: Build ─────────────────────────────────────────────────────────────
echo "[3/6] Building application..."
cd "$BUILD_DIR"
pnpm install --frozen-lockfile
BASE_PATH=/ PORT=3000 pnpm --filter @workspace/roster-app run build
pnpm --filter @workspace/api-server run build
echo "      Build complete."

# ── Step 4: Backup current install ───────────────────────────────────────────
echo "[4/6] Backing up current installation..."
BACKUP_DIR="${INSTALL_DIR}-backup-$(date +%Y%m%d%H%M%S)"
cp -r "$INSTALL_DIR" "$BACKUP_DIR"
echo "      Backup saved to $BACKUP_DIR"

# ── Step 5: Deploy new files ──────────────────────────────────────────────────
echo "[5/6] Deploying new files..."
# Copy server bundle
cp "$BUILD_DIR/artifacts/api-server/dist/index.cjs" "$INSTALL_DIR/server/"

# Copy frontend
rm -rf "$INSTALL_DIR/public"
mkdir -p "$INSTALL_DIR/public"
cp -r "$BUILD_DIR/artifacts/roster-app/dist/public/." "$INSTALL_DIR/public/"

# Copy any new migration files
NEW_MIGRATIONS=0
if [ -d "$BUILD_DIR/lib/db/drizzle" ]; then
  mkdir -p "$INSTALL_DIR/migrations"
  for SQL_FILE in "$BUILD_DIR"/lib/db/drizzle/*.sql; do
    MIGRATION_NAME=$(basename "$SQL_FILE" .sql)
    ALREADY=$(psql "$DATABASE_URL" -tAc \
      "SELECT COUNT(*) FROM _ares_migrations WHERE name='$MIGRATION_NAME'" 2>/dev/null || echo "0")
    if [ "$ALREADY" = "0" ]; then
      cp "$SQL_FILE" "$INSTALL_DIR/migrations/"
      echo "      Queued new migration: $MIGRATION_NAME"
      NEW_MIGRATIONS=$((NEW_MIGRATIONS + 1))
    fi
  done
fi

# Preserve .env (do not overwrite)
chown -R www-data:www-data "$INSTALL_DIR/server" "$INSTALL_DIR/public"
echo "      Files deployed."

# ── Step 6: Apply migrations and restart ─────────────────────────────────────
echo "[6/6] Applying migrations and restarting service..."

if [ "$NEW_MIGRATIONS" -gt 0 ]; then
  for SQL_FILE in "$INSTALL_DIR"/migrations/*.sql; do
    MIGRATION_NAME=$(basename "$SQL_FILE" .sql)
    ALREADY=$(psql "$DATABASE_URL" -tAc \
      "SELECT COUNT(*) FROM _ares_migrations WHERE name='$MIGRATION_NAME'" 2>/dev/null || echo "0")
    if [ "$ALREADY" = "0" ]; then
      echo "      Applying: $MIGRATION_NAME"
      psql "$DATABASE_URL" -f "$SQL_FILE"
      psql "$DATABASE_URL" -c "INSERT INTO _ares_migrations (name) VALUES ('$MIGRATION_NAME');"
    fi
  done
else
  echo "      No new migrations."
fi

systemctl restart "$SERVICE_NAME"
sleep 2

if systemctl is-active --quiet "$SERVICE_NAME"; then
  echo "      Service restarted successfully."
else
  echo "[WARN] Service did not start — rolling back..."
  cp -r "$BACKUP_DIR/server" "$INSTALL_DIR/server"
  cp -r "$BACKUP_DIR/public" "$INSTALL_DIR/public"
  systemctl restart "$SERVICE_NAME"
  echo "      Rollback complete. Check logs: journalctl -u $SERVICE_NAME -n 50"
  rm -rf "$BUILD_DIR"
  exit 1
fi

# ── Cleanup ───────────────────────────────────────────────────────────────────
rm -rf "$BUILD_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Update Complete!                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Service: $(systemctl is-active $SERVICE_NAME)"
echo "  Backup:  $BACKUP_DIR  (delete when satisfied)"
echo "  Logs:    journalctl -u $SERVICE_NAME -f"
echo ""
