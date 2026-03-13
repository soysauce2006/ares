#!/bin/bash
# Builds A.R.E.S. and packages it as a self-contained LAMP deployment archive.
# Output: ares-lamp-<date>.tar.gz in the project root.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATE=$(date +%Y%m%d)
PACKAGE_NAME="ares-lamp-${DATE}"
STAGING="${ROOT}/.lamp-staging/${PACKAGE_NAME}"

echo "╔══════════════════════════════════════════╗"
echo "║   A.R.E.S.  —  LAMP Package Builder      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: Build frontend ────────────────────────────────────────────────────
echo "[1/4] Building frontend..."
BASE_PATH=/ PORT=3000 pnpm --filter @workspace/roster-app run build

# ── Step 2: Build API server ──────────────────────────────────────────────────
echo "[2/4] Building API server..."
pnpm --filter @workspace/api-server run build

# ── Step 3: Assemble staging directory ───────────────────────────────────────
echo "[3/4] Assembling package..."
rm -rf "${ROOT}/.lamp-staging"
mkdir -p "${STAGING}/server"
mkdir -p "${STAGING}/public"
mkdir -p "${STAGING}/migrations"
mkdir -p "${STAGING}/deploy"

# API server bundle (esbuild output — fully self-contained, no npm install needed)
cp "${ROOT}/artifacts/api-server/dist/index.cjs" "${STAGING}/server/"

# Frontend static files
cp -r "${ROOT}/artifacts/roster-app/dist/public/." "${STAGING}/public/"

# Database migration SQL
cp "${ROOT}/lib/db/drizzle/0000_military_molten_man.sql" \
   "${STAGING}/migrations/0000_initial_schema.sql"

# Deployment helpers
cp "${ROOT}/deploy/apache-ares.conf"  "${STAGING}/deploy/"
cp "${ROOT}/deploy/ares.service"      "${STAGING}/deploy/"
cp "${ROOT}/deploy/setup.sh"          "${STAGING}/deploy/"
chmod +x "${STAGING}/deploy/setup.sh"

# Env template
cat > "${STAGING}/.env.example" <<'ENV'
# Copy this to .env and fill in real values
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://ares_user:YOURPASSWORD@localhost:5432/ares
ENV

# Quick-start README
cat > "${STAGING}/README.txt" <<'README'
A.R.E.S. — Advanced Roster Execution System
LAMP Server Deployment Package
══════════════════════════════════════════════

REQUIREMENTS
  - Ubuntu 20.04 / 22.04 / 24.04 (or any Debian-based distro)
  - Apache2 (already installed on your LAMP stack)
  - Node.js 24 (installer will add if missing)
  - PostgreSQL (installer will add if missing)

QUICK INSTALL (automated)
  sudo bash deploy/setup.sh

  The script will:
    1. Install Node.js 24 and PostgreSQL (if not present)
    2. Create the "ares" database and generate a secure password
    3. Copy app files to /opt/ares
    4. Apply the database schema
    5. Configure Apache as a reverse proxy on port 80
    6. Install and start the "ares" systemd service

MANUAL INSTALL
  See MANUAL_INSTALL.txt for step-by-step instructions.

AFTER INSTALL
  - Default login:  admin@admin.local  /  Password%1
  - CHANGE THE ADMIN PASSWORD immediately after first login
  - Enable HTTPS:   sudo apt install certbot python3-certbot-apache
                    sudo certbot --apache -d your-domain.com

MANAGING THE SERVICE
  sudo systemctl status ares     # Check status
  sudo systemctl restart ares    # Restart
  sudo journalctl -u ares -f     # Live logs

PACKAGE CONTENTS
  server/index.cjs               Node.js API server (self-contained bundle)
  public/                        Built frontend static files
  migrations/0000_initial_schema.sql  Full database schema
  deploy/apache-ares.conf        Apache virtual host config
  deploy/ares.service            systemd service unit
  deploy/setup.sh                Automated installer
  .env.example                   Environment variable template
README

# Manual install guide
cat > "${STAGING}/MANUAL_INSTALL.txt" <<'MANUAL'
A.R.E.S. — Manual Installation Steps
══════════════════════════════════════════════

1. INSTALL NODE.JS 24
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt-get install -y nodejs

2. INSTALL POSTGRESQL
   sudo apt-get install -y postgresql postgresql-client
   sudo systemctl enable --now postgresql

3. CREATE DATABASE
   sudo -u postgres psql <<SQL
     CREATE USER ares_user WITH PASSWORD 'your_strong_password';
     CREATE DATABASE ares OWNER ares_user;
   SQL

4. COPY APP FILES
   sudo mkdir -p /opt/ares
   sudo cp -r server/ public/ migrations/ /opt/ares/
   sudo chown -R www-data:www-data /opt/ares

5. CREATE ENVIRONMENT FILE
   sudo tee /opt/ares/.env <<ENV
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=postgres://ares_user:your_strong_password@localhost:5432/ares
   ENV
   sudo chmod 600 /opt/ares/.env

6. APPLY DATABASE SCHEMA
   psql postgres://ares_user:your_strong_password@localhost:5432/ares \
     -f /opt/ares/migrations/0000_initial_schema.sql

7. INSTALL SYSTEMD SERVICE
   sudo cp deploy/ares.service /etc/systemd/system/ares.service
   sudo systemctl daemon-reload
   sudo systemctl enable ares
   sudo systemctl start ares

8. CONFIGURE APACHE PROXY
   sudo apt-get install -y apache2
   sudo a2enmod proxy proxy_http rewrite
   sudo cp deploy/apache-ares.conf /etc/apache2/sites-available/ares.conf
   # Edit ares.conf: replace "your-domain.com" with your actual domain
   sudo a2ensite ares.conf
   sudo a2dissite 000-default.conf
   sudo systemctl reload apache2

9. VERIFY
   curl http://localhost:3000/api/healthz
   # Should return: {"status":"ok"}

10. ENABLE HTTPS (OPTIONAL BUT RECOMMENDED)
    sudo apt install certbot python3-certbot-apache
    sudo certbot --apache -d your-domain.com
MANUAL

# ── Step 4: Create tar.gz ─────────────────────────────────────────────────────
echo "[4/4] Creating archive..."
cd "${ROOT}/.lamp-staging"
tar -czf "${ROOT}/${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}/"
cd "${ROOT}"

# Clean up staging
rm -rf "${ROOT}/.lamp-staging"

ARCHIVE_SIZE=$(du -sh "${ROOT}/${PACKAGE_NAME}.tar.gz" | cut -f1)

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Package Ready!                    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Archive:  ${PACKAGE_NAME}.tar.gz  (${ARCHIVE_SIZE})"
echo ""
echo "  To deploy on your server:"
echo "    scp ${PACKAGE_NAME}.tar.gz user@your-server:/tmp/"
echo "    ssh user@your-server"
echo "    cd /tmp && tar xzf ${PACKAGE_NAME}.tar.gz"
echo "    sudo bash ${PACKAGE_NAME}/deploy/setup.sh"
echo ""
