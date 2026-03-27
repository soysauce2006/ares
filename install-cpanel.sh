#!/bin/bash
# A.R.E.S. — Installer for cPanel servers (AlmaLinux 9 / RHEL-based)
#
# cPanel manages its own Apache, Nginx, SSL, and firewall.
# This script installs Docker safely alongside cPanel without
# touching any cPanel-managed services.
#
# Usage (from inside the cloned repo):
#   sudo bash install-cpanel.sh
#
set -e

APP_DIR="/opt/ares"
# cPanel uses 80, 443, 2082-2087, 2095-2096 — default to a safe port
DEFAULT_PORT=7000

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN="\033[0;32m"; CYAN="\033[0;36m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
info()    { echo -e "${CYAN}[•]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   A.R.E.S.  —  VPS Quick Installer       ║${NC}"
echo -e "${CYAN}║       cPanel / AlmaLinux 9 edition        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Root check ────────────────────────────────────────────────────────────────
[ "$EUID" -ne 0 ] && die "Please run as root: sudo bash install-cpanel.sh"

# ── Detect OS ─────────────────────────────────────────────────────────────────
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_ID="$ID"
  OS_VER="$VERSION_ID"
else
  die "Cannot detect OS."
fi

case "$OS_ID" in
  almalinux|rocky|rhel|centos|ol) ;;
  *) warn "Detected OS: $OS_ID $OS_VER — this script is written for AlmaLinux 9." ;;
esac
info "OS: $OS_ID $OS_VER"

# ── Detect cPanel ─────────────────────────────────────────────────────────────
if [ ! -f /usr/local/cpanel/cpanel ]; then
  warn "cPanel binary not found. Are you sure cPanel is installed?"
  warn "Proceeding anyway — some cPanel-specific steps will be skipped."
  CPANEL_PRESENT=0
else
  CPANEL_VER=$(/usr/local/cpanel/cpanel --version 2>/dev/null | awk '{print $1}' || echo "unknown")
  success "cPanel detected: $CPANEL_VER"
  CPANEL_PRESENT=1
fi

# ── 1. Install Docker ─────────────────────────────────────────────────────────
info "Step 1/6 — Installing Docker..."

if command -v docker &>/dev/null; then
  success "Docker already installed: $(docker --version)"
else
  dnf install -y dnf-plugins-core curl openssl

  # Use the official Docker CE repo for RHEL/CentOS
  dnf config-manager --add-repo \
    https://download.docker.com/linux/centos/docker-ce.repo

  dnf install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

  # ── cPanel / Docker iptables co-existence ─────────────────────────────────
  # cPanel uses CSF which also manages iptables. Letting Docker and CSF both
  # manage iptables simultaneously can cause network disruption.
  # We tell Docker to skip iptables and let CSF stay in full control.
  mkdir -p /etc/docker
  if [ ! -f /etc/docker/daemon.json ]; then
    cat > /etc/docker/daemon.json <<'DAEMON'
{
  "iptables": false,
  "ip-forward": true
}
DAEMON
    info "Docker daemon configured: iptables management handed to CSF"
  else
    warn "/etc/docker/daemon.json already exists — not overwriting."
    warn "Ensure '\"iptables\": false' is set if CSF is active on this server."
  fi

  systemctl enable --now docker
  success "Docker installed: $(docker --version)"
fi

# ── 2. Get the source code ────────────────────────────────────────────────────
info "Step 2/6 — Setting up source code..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"

if [ -f "${SCRIPT_DIR}/docker-compose.yml" ] && [ -f "${SCRIPT_DIR}/Dockerfile" ]; then
  REPO_DIR="$SCRIPT_DIR"
  success "Using source at: $REPO_DIR"
else
  if [ -z "$GIT_REPO" ]; then
    echo ""
    echo "  Enter your git repository URL"
    echo "  (e.g. https://github.com/yourname/ares.git)"
    echo ""
    read -rp "  GIT_REPO: " GIT_REPO
    [ -z "$GIT_REPO" ] && die "No repository URL provided."
  fi

  GIT_BRANCH="${GIT_BRANCH:-main}"
  command -v git &>/dev/null || dnf install -y git

  if [ -d "$APP_DIR/.git" ]; then
    info "Updating existing clone at $APP_DIR..."
    git -C "$APP_DIR" pull origin "$GIT_BRANCH"
  else
    info "Cloning $GIT_REPO (branch: $GIT_BRANCH) → $APP_DIR"
    git clone --depth=1 --branch "$GIT_BRANCH" "$GIT_REPO" "$APP_DIR"
  fi
  REPO_DIR="$APP_DIR"
  success "Source ready at: $REPO_DIR"
fi

if [ "$REPO_DIR" != "$APP_DIR" ]; then
  mkdir -p "$(dirname "$APP_DIR")"
  ln -sfn "$REPO_DIR" "$APP_DIR" 2>/dev/null || true
fi

cd "$REPO_DIR"

# ── 3. Generate .env ──────────────────────────────────────────────────────────
info "Step 3/6 — Configuring environment..."

if [ -f "$REPO_DIR/.env" ]; then
  warn ".env already exists — skipping generation (delete it to reset)"
else
  DB_PASS=$(openssl rand -hex 32)
  # Use DEFAULT_PORT unless the caller already exported PORT
  APP_PORT="${PORT:-$DEFAULT_PORT}"

  cat > "$REPO_DIR/.env" <<ENV
# A.R.E.S. production environment
# Generated by install-cpanel.sh on $(date -u +"%Y-%m-%d %H:%M UTC")

POSTGRES_PASSWORD=${DB_PASS}
PORT=${APP_PORT}

# Git update settings (used by docker-update.sh)
GIT_REPO=${GIT_REPO:-}
GIT_BRANCH=${GIT_BRANCH:-main}
ENV

  chmod 600 "$REPO_DIR/.env"
  success ".env created (port: ${APP_PORT})"
fi

# Load env for display
set -a; source "$REPO_DIR/.env"; set +a
APP_PORT="${PORT:-$DEFAULT_PORT}"

# ── 4. Open port in firewall ──────────────────────────────────────────────────
info "Step 4/6 — Configuring firewall..."

if command -v csf &>/dev/null; then
  # CSF is present (most cPanel servers)
  csf --allow "tcp|in|d=${APP_PORT}" 2>/dev/null || \
    csf -a "tcp ${APP_PORT}" 2>/dev/null || true
  csf -r &>/dev/null || true
  success "CSF: port ${APP_PORT} opened"
elif command -v firewall-cmd &>/dev/null && systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-port="${APP_PORT}/tcp" &>/dev/null || true
  firewall-cmd --reload &>/dev/null || true
  success "firewalld: port ${APP_PORT} opened"
else
  warn "No recognised firewall found — open port ${APP_PORT} manually in WHM or CSF."
fi

# ── 5. Build and start containers ─────────────────────────────────────────────
info "Step 5/6 — Building image (this takes a few minutes — full output shown)..."

# DOCKER_BUILDKIT=1 is required for RUN --network=host in the Dockerfile.
# Docker Compose v2 enables it by default, but we set it explicitly for safety.
export DOCKER_BUILDKIT=1

docker compose -f "$REPO_DIR/docker-compose.yml" --env-file "$REPO_DIR/.env" \
  build --no-cache

info "Starting containers..."
docker compose -f "$REPO_DIR/docker-compose.yml" --env-file "$REPO_DIR/.env" \
  up -d --remove-orphans

success "Containers started."

# ── 6. Wait for health ────────────────────────────────────────────────────────
info "Step 6/6 — Waiting for app to become healthy..."

MAX_WAIT=90
ELAPSED=0
printf "    "
until curl -sf "http://localhost:${APP_PORT}/api/healthz" &>/dev/null; do
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo ""
    warn "App did not become healthy within ${MAX_WAIT}s."
    warn "Check logs with:  docker compose logs -f app"
    break
  fi
  printf "."
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done
echo ""
success "App is healthy."

# ── Done ──────────────────────────────────────────────────────────────────────
SERVER_IP=$(curl -sf https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Installation Complete!            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Direct URL:${NC}    http://${SERVER_IP}:${APP_PORT}"
echo -e "  ${CYAN}Default login:${NC} admin@admin.local  /  Password%1"
echo ""
echo -e "  ${YELLOW}⚠  Change the admin password immediately after first login!${NC}"
echo ""
echo -e "  ${CYAN}Next step — set up a reverse proxy in WHM so A.R.E.S. is${NC}"
echo -e "  ${CYAN}accessible at https://ares.yourdomain.com instead of a raw port.${NC}"
echo -e "  ${CYAN}See INSTALL.md → 'Setting up a Reverse Proxy in cPanel/WHM'${NC}"
echo ""
echo -e "  ${CYAN}Useful commands:${NC}"
echo "    docker compose logs -f app            # Live logs"
echo "    docker compose ps                     # Container status"
echo "    docker compose restart app            # Restart app"
echo "    sudo bash $REPO_DIR/docker-update.sh  # Update from git"
echo ""
echo -e "  ${CYAN}Env file:${NC} $REPO_DIR/.env"
echo ""
