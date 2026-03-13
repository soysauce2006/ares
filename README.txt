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
    7. Install the git update script at /opt/ares/update.sh

MANUAL INSTALL
  See MANUAL_INSTALL.txt for step-by-step instructions.

AFTER INSTALL
  - Default login:  admin@admin.local  /  Password%1
  - CHANGE THE ADMIN PASSWORD immediately after first login
  - Enable HTTPS:   sudo apt install certbot python3-certbot-apache
                    sudo certbot --apache -d your-domain.com

UPDATING FROM GIT
  After the initial install, you can update the app directly from your
  git repository without creating a new package:

  1. Set your repo URL in /opt/ares/.env:
       GIT_REPO=https://github.com/yourname/ares.git
       GIT_BRANCH=main

  2. Run the update script:
       sudo bash /opt/ares/update.sh

  The update script will:
    - Clone the latest code from git
    - Install dependencies and rebuild everything
    - Back up the current install before replacing files
    - Apply any new database migrations automatically
    - Restart the service (rolls back if startup fails)

  You can also pass the repo URL directly:
    sudo bash /opt/ares/update.sh https://github.com/yourname/ares.git

MANAGING THE SERVICE
  sudo systemctl status ares          # Check status
  sudo systemctl restart ares         # Restart
  sudo journalctl -u ares -f          # Live logs
  sudo bash /opt/ares/update.sh       # Update from git

PACKAGE CONTENTS
  server/index.cjs               Node.js API server (self-contained bundle)
  public/                        Built frontend static files
  migrations/0000_initial_schema.sql  Full database schema
  deploy/apache-ares.conf        Apache virtual host config
  deploy/ares.service            systemd service unit
  deploy/setup.sh                Automated installer
  deploy/update.sh               Git update + rebuild + redeploy script
  .env.example                   Environment variable template
