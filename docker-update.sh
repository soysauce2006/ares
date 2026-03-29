#!/bin/bash
# A.R.E.S. — Docker update script
# Pulls latest code from git, rebuilds containers, and restarts with zero secrets-loss.
#
# Usage:
#   sudo bash /opt/ares/docker-update.sh
#   sudo bash /opt/ares/docker-update.sh https://github.com/you/repo.git
#
set -e

GREEN="\033[0;32m"; CYAN="\033[0;36m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
info()    { echo -e "${CYAN}[•]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

[ "$EUID" -ne 0 ] && die "Please run as root: sudo bash docker-update.sh"

# ── Find repo directory ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"

[ ! -f "$REPO_DIR/docker-compose.yml" ] && die "docker-compose.yml not found in $REPO_DIR"

# Load .env for GIT_REPO / GIT_BRANCH
[ -f "$REPO_DIR/.env" ] && { set -a; source "$REPO_DIR/.env"; set +a; }

GIT_REPO="${1:-$GIT_REPO}"
GIT_BRANCH="${GIT_BRANCH:-main}"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   A.R.E.S.  —  Docker Update             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Pull latest code ───────────────────────────────────────────────────────
info "Step 1/4 — Pulling latest code..."

if [ -d "$REPO_DIR/.git" ] && [ -z "$GIT_REPO" ]; then
  # Repo already cloned, no explicit URL — just pull
  git -C "$REPO_DIR" pull
  success "Pulled latest commits."
elif [ -n "$GIT_REPO" ]; then
  if [ -d "$REPO_DIR/.git" ]; then
    info "Fetching from $GIT_REPO (branch: $GIT_BRANCH)..."
    git -C "$REPO_DIR" fetch origin
    git -C "$REPO_DIR" reset --hard "origin/$GIT_BRANCH"
    success "Reset to latest origin/$GIT_BRANCH."
  else
    die "Not a git repo and no .git directory found. Run install.sh first."
  fi
else
  warn "No GIT_REPO configured — skipping git pull."
  warn "Set GIT_REPO in $REPO_DIR/.env to enable automatic pulling."
fi

cd "$REPO_DIR"

# ── 2. Rebuild containers ─────────────────────────────────────────────────────
info "Step 2/4 — Rebuilding containers (this may take a few minutes)..."

GIT_COMMIT=$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
info "Baking commit hash: $GIT_COMMIT"

docker compose --env-file "$REPO_DIR/.env" build --no-cache --build-arg GIT_COMMIT="$GIT_COMMIT"

success "Build complete."

# ── 3. Restart with new image ─────────────────────────────────────────────────
info "Step 3/4 — Restarting containers..."

docker compose --env-file "$REPO_DIR/.env" up -d --remove-orphans

success "Containers restarted."

# ── 4. Health check ───────────────────────────────────────────────────────────
info "Step 4/4 — Waiting for app to become healthy..."

APP_PORT="${PORT:-8080}"
MAX_WAIT=60
ELAPSED=0
printf "    "
until curl -sf "http://localhost:${APP_PORT}/api/healthz" &>/dev/null; do
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo ""
    warn "App did not respond within ${MAX_WAIT}s."
    warn "Check logs:  docker compose logs -f app"
    exit 1
  fi
  printf "."
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done
echo ""
success "App is healthy."

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Update Complete!                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  docker compose logs -f app   # Live logs"
echo ""
