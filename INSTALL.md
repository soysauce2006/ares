# A.R.E.S. — VPS Installation Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Install — Ubuntu / Debian](#quick-install--ubuntu--debian)
3. [Quick Install — AlmaLinux / Rocky / RHEL](#quick-install--almalinux--rocky--rhel)
4. [Installing alongside a Control Panel (CWP, cPanel, Plesk, Webmin)](#installing-alongside-a-control-panel)
5. [Setting up a Reverse Proxy in CWP](#setting-up-a-reverse-proxy-in-cwp)
6. [Enabling HTTPS](#enabling-https)
7. [Updating A.R.E.S.](#updating-ares)
8. [Useful Commands](#useful-commands)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| RAM | 1 GB | 2 GB |
| CPU | 1 vCPU | 2 vCPU |
| Disk | 5 GB free | 10 GB free |
| OS | Ubuntu 20.04 / AlmaLinux 8 | Ubuntu 22.04 / AlmaLinux 9 |
| Open port | 8080 (or custom) | 80 + 443 with reverse proxy |

No other software needs to be pre-installed. The scripts handle Docker and everything else automatically.

---

## Quick Install — Ubuntu / Debian

```bash
# 1. Upload or clone the project folder to your server
git clone https://github.com/yourname/ares.git /opt/ares

# 2. Run the installer
cd /opt/ares
sudo bash install.sh
```

The installer will:
- Install Docker and Docker Compose
- Generate a secure random database password
- Build and start the application
- Print the access URL when done

**Default login:** `admin@admin.local` / `Password%1`
> Change this immediately after your first login.

---

## Quick Install — AlmaLinux / Rocky / RHEL

```bash
# 1. Upload or clone the project folder to your server
git clone https://github.com/yourname/ares.git /opt/ares

# 2. Run the AlmaLinux-specific installer
cd /opt/ares
sudo bash install-almalinux.sh
```

This script uses `dnf` instead of `apt`, adds the Docker CE CentOS repository, and automatically opens the app port in `firewalld`.

Compatible with: AlmaLinux 8/9, Rocky Linux 8/9, RHEL 8/9, CentOS Stream 9, Oracle Linux 8/9.

---

## Installing alongside a Control Panel

Control panels like **CWP (Control Web Panel)**, cPanel, Plesk, Webmin, DirectAdmin, and HestiaCP run their own web services that occupy common ports. Follow these steps to run A.R.E.S. alongside them without conflicts.

### Port conflict — the most common issue

| Control Panel | Ports it uses |
|---------------|---------------|
| CWP | 80, 443, **8080** (admin), 2030, 2031 |
| cPanel/WHM | 80, 443, 2082, 2083, 2086, 2087 |
| Plesk | 80, 443, 8443, 8880 |
| Webmin | 80, 443, **10000** |
| HestiaCP | 80, 443, **8083** |

**CWP uses port 8080 for its own admin panel.** You must change A.R.E.S. to a different port before installing.

### Step 1 — Choose a free port

Pick any port not used by your control panel. Common choices: `3000`, `4000`, `5000`, `7000`, `9000`.

### Step 2 — Set the port before running the installer

```bash
cd /opt/ares

# Create .env manually with your chosen port
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 32)
PORT=3000
GIT_REPO=
GIT_BRANCH=main
EOF
chmod 600 .env
```

Then run the installer normally — it will detect the existing `.env` and skip generation:

```bash
# Ubuntu/Debian:
sudo bash install.sh

# AlmaLinux/RHEL:
sudo bash install-almalinux.sh
```

### Step 3 — Open the port in your firewall

**CWP with CSF firewall:**
1. Log into CWP Admin → **Security** → **CSF Firewall**
2. Go to **Allow Incoming** and add your port (e.g. `3000`)
3. Click **Restart CSF**

Or via SSH:
```bash
csf -a tcp 3000   # allow port 3000
csf -r            # restart CSF
```

**AlmaLinux firewalld (without CWP):**
```bash
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --reload
```

**Ubuntu ufw:**
```bash
ufw allow 3000/tcp
```

A.R.E.S. is now reachable at `http://your-server-ip:3000`.

> **Recommended next step:** set up a reverse proxy so the app is accessible on a subdomain at port 80/443 instead of a raw port.

---

## Setting up a Reverse Proxy in CWP

A reverse proxy lets you access A.R.E.S. at a proper URL like `https://ares.yourdomain.com` instead of `http://ip:3000`.

### In CWP — using the built-in Nginx proxy manager

1. **Create a subdomain** in CWP:
   - Log into CWP Admin → **Domains** → **Subdomains**
   - Add `ares.yourdomain.com` (point it to any document root, e.g. `/home/user/public_html/ares`)

2. **Add a Nginx proxy vhost:**
   - Go to **Nginx** → **vHost Manager** → **Add vHost**
   - Set domain to `ares.yourdomain.com`
   - In the custom directives box, paste:

```nginx
location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection 'upgrade';
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

3. **Rebuild Nginx config** in CWP and restart Nginx.

### Manual Nginx config (without CWP's GUI)

Create the file `/etc/nginx/conf.d/ares.conf`:

```nginx
server {
    listen 80;
    server_name ares.yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then apply:
```bash
nginx -t && systemctl reload nginx
```

### Manual Apache config (if CWP is using Apache)

Enable the required modules first:
```bash
a2enmod proxy proxy_http headers   # Ubuntu/Debian
# AlmaLinux: modules are already enabled by default
```

Create `/etc/httpd/conf.d/ares.conf` (AlmaLinux) or `/etc/apache2/sites-available/ares.conf` (Ubuntu):

```apache
<VirtualHost *:80>
    ServerName ares.yourdomain.com

    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    RequestHeader set X-Forwarded-Proto "http"
</VirtualHost>
```

Ubuntu — enable the site and reload:
```bash
a2ensite ares.conf && systemctl reload apache2
```

AlmaLinux — just reload:
```bash
systemctl reload httpd
```

---

## Enabling HTTPS

Once your subdomain resolves (DNS A record pointing to your server IP), run Certbot to get a free SSL certificate.

**Ubuntu / Debian:**
```bash
apt install -y certbot python3-certbot-nginx   # or python3-certbot-apache
certbot --nginx -d ares.yourdomain.com
```

**AlmaLinux / RHEL:**
```bash
dnf install -y certbot python3-certbot-nginx   # or python3-certbot-apache
certbot --nginx -d ares.yourdomain.com
```

**In CWP** — you can also use the built-in AutoSSL / Let's Encrypt manager:
- Go to **SSL** → **Manage SSL** → select your subdomain → **Issue Let's Encrypt Certificate**

Certbot auto-renews every 90 days. The renewal timer is installed automatically.

---

## Updating A.R.E.S.

After the initial install, pull the latest code and rebuild with one command:

```bash
sudo bash /opt/ares/docker-update.sh
```

This will:
1. Pull the latest code from git
2. Rebuild the Docker image with `--no-cache`
3. Restart the container with zero downtime rollover
4. Run a health check to confirm the app is up

> Your `.env` file and database data are preserved across updates.

---

## Useful Commands

```bash
# View live application logs
docker compose -f /opt/ares/docker-compose.yml logs -f app

# View database logs
docker compose -f /opt/ares/docker-compose.yml logs -f db

# Check container status
docker compose -f /opt/ares/docker-compose.yml ps

# Restart the app container only
docker compose -f /opt/ares/docker-compose.yml restart app

# Stop everything
docker compose -f /opt/ares/docker-compose.yml down

# Start everything back up
docker compose -f /opt/ares/docker-compose.yml up -d

# Open a shell inside the running app container
docker compose -f /opt/ares/docker-compose.yml exec app sh
```

---

## Troubleshooting

### App won't start / health check fails

```bash
docker compose -f /opt/ares/docker-compose.yml logs app
```

Look for database connection errors — the most common cause is the `POSTGRES_PASSWORD` in `.env` not matching what the database container started with.

**Fix:** Stop everything, remove the database volume, and reinstall:
```bash
docker compose -f /opt/ares/docker-compose.yml down -v
sudo bash install.sh   # or install-almalinux.sh
```

---

### Build fails with "exit code: 1"

Run the build step in isolation to see the full output:
```bash
cd /opt/ares
docker compose build --no-cache 2>&1 | cat
```

Scroll up in the output to find the first ERROR line — that is the real failure, not the summary line at the bottom.

---

### Port already in use

Check what is using a port:
```bash
ss -tlnp | grep 8080
```

Change A.R.E.S. to a different port by editing `.env`:
```bash
nano /opt/ares/.env
# Change PORT=8080 to PORT=3000 (or any free port)
```

Then restart:
```bash
docker compose -f /opt/ares/docker-compose.yml down
docker compose -f /opt/ares/docker-compose.yml up -d
```

---

### CWP blocks connections to Docker containers

CWP's CSF firewall can block loopback traffic. If Nginx can't reach `127.0.0.1:3000`:

```bash
# Whitelist the loopback interface in CSF
echo "127.0.0.1" >> /etc/csf/csf.allow
csf -r
```

Or in CSF settings (`/etc/csf/csf.conf`), ensure `LOCALMASK = "1"` is set.

---

### SELinux blocks Nginx reverse proxy (AlmaLinux / RHEL)

If Nginx returns a 502 Bad Gateway and SELinux is enforcing:

```bash
# Allow Nginx to connect to network (one-time command)
setsebool -P httpd_can_network_connect 1
```

---

### App is accessible but shows a blank page

This is almost always a browser cache issue after changing ports or domains.

```
Hard-refresh: Ctrl + Shift + R  (Windows/Linux)
              Cmd + Shift + R   (Mac)
```
