#!/bin/bash
# A.R.E.S. LAMP Server Setup Script
# Run as root on Ubuntu 20.04 / 22.04 / 24.04
set -e

INSTALL_DIR="/opt/ares"
SERVICE_USER="www-data"
APP_PORT="3000"

echo "╔══════════════════════════════════════════╗"
echo "║   A.R.E.S.  —  LAMP Server Installer     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "[ERROR] Please run as root (sudo bash setup.sh)"
  exit 1
fi

# ── 1. Install Node.js 24 ─────────────────────────────────────────────────────
echo "[1/7] Installing Node.js 24..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
echo "      Node.js $(node -v) ready."

# ── 2. Install PostgreSQL ─────────────────────────────────────────────────────
echo "[2/7] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-client
systemctl enable --now postgresql
echo "      PostgreSQL ready."

# ── 3. Create database and user ───────────────────────────────────────────────
echo "[3/7] Setting up database..."
DB_PASS=$(openssl rand -hex 24)
sudo -u postgres psql -c "CREATE USER ares_user WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ares OWNER ares_user;" 2>/dev/null || true
DATABASE_URL="postgres://ares_user:${DB_PASS}@localhost:5432/ares"
echo "      Database ready."

# ── 4. Install app files ──────────────────────────────────────────────────────
echo "[4/7] Installing application..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/migrations"
cp -r "$PACKAGE_DIR/server" "$INSTALL_DIR/server"
cp -r "$PACKAGE_DIR/public" "$INSTALL_DIR/public"
[ -f "$PACKAGE_DIR/migrations/0000_initial_schema.sql" ] && \
  cp "$PACKAGE_DIR/migrations/0000_initial_schema.sql" "$INSTALL_DIR/migrations/"

# Install the update script so admins can run: sudo bash /opt/ares/update.sh
cp "$PACKAGE_DIR/deploy/update.sh" "$INSTALL_DIR/update.sh"
chmod +x "$INSTALL_DIR/update.sh"

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
echo "      Application installed to $INSTALL_DIR."

# ── 5. Write .env ─────────────────────────────────────────────────────────────
echo "[5/7] Writing environment config..."
cat > "$INSTALL_DIR/.env" <<ENV
NODE_ENV=production
PORT=${APP_PORT}
DATABASE_URL=${DATABASE_URL}

# Git update settings — fill in to enable: sudo bash /opt/ares/update.sh
GIT_REPO=
GIT_BRANCH=main
ENV
chmod 600 "$INSTALL_DIR/.env"
chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env"
echo "      Config written to $INSTALL_DIR/.env"

# ── 6. Apply database migrations ─────────────────────────────────────────────
echo "[6/7] Applying database migrations..."
sudo -u "$SERVICE_USER" \
  DATABASE_URL="$DATABASE_URL" \
  psql "$DATABASE_URL" -c "
    CREATE TABLE IF NOT EXISTS _ares_migrations (
      id serial PRIMARY KEY,
      name text NOT NULL UNIQUE,
      applied_at timestamptz DEFAULT now()
    );" 2>/dev/null || true

MIGRATION_APPLIED=$(sudo -u postgres psql "$DATABASE_URL" -tAc \
  "SELECT COUNT(*) FROM _ares_migrations WHERE name='0000_initial_schema'" 2>/dev/null || echo "0")

if [ "$MIGRATION_APPLIED" = "0" ]; then
  sudo -u postgres psql "$DATABASE_URL" -f "$INSTALL_DIR/migrations/0000_initial_schema.sql"
  sudo -u postgres psql "$DATABASE_URL" -c \
    "INSERT INTO _ares_migrations (name) VALUES ('0000_initial_schema');"
  echo "      Schema applied."
else
  echo "      Schema already applied — skipped."
fi

# ── 7. Configure Apache + systemd ─────────────────────────────────────────────
echo "[7/7] Configuring Apache and systemd..."

# Enable required Apache modules
a2enmod proxy proxy_http proxy_wstunnel rewrite

# Install vhost config
cp "$PACKAGE_DIR/deploy/apache-ares.conf" /etc/apache2/sites-available/ares.conf
a2ensite ares.conf
a2dissite 000-default.conf 2>/dev/null || true
systemctl reload apache2

# Install systemd service
sed "s|/opt/ares|${INSTALL_DIR}|g; s|PORT=3000|PORT=${APP_PORT}|g" \
  "$PACKAGE_DIR/deploy/ares.service" > /etc/systemd/system/ares.service
systemctl daemon-reload
systemctl enable ares
systemctl start ares

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Installation Complete!            ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  App running at:  http://$(hostname -I | awk '{print $1}')"
echo "  Service status:  systemctl status ares"
echo "  Logs:            journalctl -u ares -f"
echo "  DB password:     $DB_PASS  (also saved in $INSTALL_DIR/.env)"
echo ""
echo "  To enable HTTPS:  apt install certbot python3-certbot-apache"
echo "                    certbot --apache -d your-domain.com"
echo ""
echo "  Default login:   admin@admin.local / Password%1"
echo "  Change the admin password immediately after first login!"
echo ""
echo "  To update from git later:"
echo "    1. Edit $INSTALL_DIR/.env — add GIT_REPO=https://github.com/you/repo.git"
echo "    2. sudo bash $INSTALL_DIR/update.sh"
echo ""
