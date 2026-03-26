# A.R.E.S. — VPS Installation Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Install — Ubuntu / Debian](#quick-install--ubuntu--debian)
3. [Quick Install — AlmaLinux / RHEL](#quick-install--almalinux--rhel)
4. [Quick Install — Rocky Linux 9](#quick-install--rocky-linux-9)
5. [Quick Install — cPanel on AlmaLinux 9](#quick-install--cpanel-on-almalinux-9)
6. [Installing alongside a Control Panel (CWP, Plesk, Webmin)](#installing-alongside-a-control-panel)
7. [Setting up a Reverse Proxy in CWP](#setting-up-a-reverse-proxy-in-cwp)
8. [Setting up a Reverse Proxy in cPanel / WHM](#setting-up-a-reverse-proxy-in-cpanel--whm)
9. [Publishing — Going Live at a Domain](#publishing--going-live-at-a-domain)
10. [Enabling HTTPS](#enabling-https)
11. [Updating A.R.E.S.](#updating-ares)
12. [Useful Commands](#useful-commands)
13. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| RAM | 1 GB | 2 GB |
| CPU | 1 vCPU | 2 vCPU |
| Disk | 5 GB free | 10 GB free |
| OS | Ubuntu 20.04 / AlmaLinux 8 | Ubuntu 22.04 / AlmaLinux 9 |
| Open port | 8080 (or custom) | 80 + 443 via reverse proxy |

No other software needs to be pre-installed. The scripts install Docker and everything else automatically.

---

## Quick Install — Ubuntu / Debian

```bash
# Upload or clone the project folder to your server, then:
cd /path/to/project
sudo bash install.sh
```

The installer will install Docker, generate a secure database password, build and start the app, and print the access URL.

**Default login:** `admin@admin.local` / `Password%1`
> Change this immediately after your first login.

---

## Quick Install — AlmaLinux / RHEL

```bash
cd /path/to/project
sudo bash install-almalinux.sh
```

Uses `dnf`, adds the Docker CE CentOS repository, and automatically opens the app port in `firewalld`.

Compatible with: AlmaLinux 8/9, RHEL 8/9, CentOS Stream 9, Oracle Linux 8/9.

---

## Quick Install — Rocky Linux 9

Rocky Linux 9 is a certified RHEL-compatible rebuild. The dedicated installer includes extras compared to the generic AlmaLinux script:

- **EPEL repository** — installed upfront so all tooling resolves correctly
- **SELinux pre-configuration** — enables `httpd_can_network_connect` automatically so any Nginx or Apache reverse proxy can reach Docker containers without a 502 error
- **HTTP/HTTPS firewall rules** — opens ports 80 and 443 in firewalld alongside the app port so a reverse proxy works out of the box

```bash
cd /path/to/project
sudo bash install-rocky.sh
```

Compatible with Rocky Linux 8 and 9. Also works on AlmaLinux, RHEL, and Oracle Linux.

### Changing the default port (Rocky)

```bash
export PORT=3000
sudo bash install-rocky.sh
```

Or pre-create `.env` (the installer skips generation if it already exists):

```bash
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 32)
PORT=3000
GIT_REPO=
GIT_BRANCH=main
EOF
chmod 600 .env
sudo bash install-rocky.sh
```

---

## Quick Install — cPanel on AlmaLinux 9

cPanel manages its own Apache, Nginx (optional), SSL, and firewall (CSF). Running Docker alongside cPanel requires two extra considerations that this dedicated script handles automatically:

1. **iptables co-existence** — cPanel's CSF firewall and Docker both try to manage iptables. The script tells Docker to leave iptables alone (`"iptables": false` in `/etc/docker/daemon.json`) so CSF stays in full control.
2. **Port selection** — cPanel occupies ports 80, 443, 2082, 2083, 2086, 2087, 2095, and 2096. The script defaults A.R.E.S. to port **7000** to avoid all conflicts.

```bash
cd /path/to/project
sudo bash install-cpanel.sh
```

The script will:
- Detect the cPanel installation
- Install Docker CE with CSF-safe daemon settings
- Generate a secure `.env` on port 7000
- Open the port in CSF (or firewalld if CSF is not present)
- Build and start the app
- Print direct access URL and reverse proxy instructions

**After install, set up a reverse proxy** so the app is reachable at `https://ares.yourdomain.com` — see the [cPanel reverse proxy section](#setting-up-a-reverse-proxy-in-cpanel--whm) below.

### Choosing a different port

Before running the installer, export a custom port:

```bash
export PORT=9000   # any free port not used by cPanel
sudo bash install-cpanel.sh
```

Or create `.env` manually first (the installer skips generation if it already exists):

```bash
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 32)
PORT=9000
GIT_REPO=
GIT_BRANCH=main
EOF
chmod 600 .env
sudo bash install-cpanel.sh
```

---

## Installing alongside a Control Panel

Control panels like **CWP**, Plesk, Webmin, DirectAdmin, and HestiaCP run their own web services on common ports. For cPanel specifically, use `install-cpanel.sh` instead (see above).

### Port conflict reference

| Control Panel | Ports it uses |
|---------------|---------------|
| cPanel / WHM | 80, 443, 2082, 2083, 2086, 2087, 2095, 2096 |
| CWP | 80, 443, **8080** (admin), 2030, 2031 |
| Plesk | 80, 443, 8443, 8880 |
| Webmin | 80, 443, **10000** |
| HestiaCP | 80, 443, **8083** |

**CWP uses port 8080** — you must change A.R.E.S. to a different port before installing on CWP.

### Set the port before running the installer (CWP / Plesk / others)

```bash
cd /path/to/project

cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 32)
PORT=3000
GIT_REPO=
GIT_BRANCH=main
EOF
chmod 600 .env

# Ubuntu/Debian:
sudo bash install.sh

# AlmaLinux/RHEL (no cPanel):
sudo bash install-almalinux.sh
```

### Open the port in your firewall

**CWP with CSF — GUI:**
1. Log into CWP Admin → **Security** → **CSF Firewall**
2. Go to **Allow Incoming** → add your port (e.g. `3000`)
3. Click **Restart CSF**

**CWP with CSF — SSH:**
```bash
csf -a tcp 3000
csf -r
```

**AlmaLinux firewalld (no control panel):**
```bash
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --reload
```

**Ubuntu ufw:**
```bash
ufw allow 3000/tcp
```

---

## Setting up a Reverse Proxy in CWP

A reverse proxy lets you access A.R.E.S. at `https://ares.yourdomain.com` instead of `http://ip:3000`.

### CWP built-in Nginx vHost manager

1. **Create a subdomain** — CWP Admin → **Domains** → **Subdomains** → add `ares.yourdomain.com`
2. **Add a Nginx vHost** — **Nginx** → **vHost Manager** → **Add vHost**, set domain to `ares.yourdomain.com`, paste in the custom directives:

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

3. Rebuild Nginx config in CWP and restart Nginx.

### Manual Nginx config (no CWP GUI)

Create `/etc/nginx/conf.d/ares.conf`:

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

```bash
nginx -t && systemctl reload nginx
```

### Manual Apache config

Create `/etc/httpd/conf.d/ares.conf`:

```apache
<VirtualHost *:80>
    ServerName ares.yourdomain.com

    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    RequestHeader set X-Forwarded-Proto "http"
</VirtualHost>
```

```bash
systemctl reload httpd
```

---

## Setting up a Reverse Proxy in cPanel / WHM

cPanel runs **EasyApache 4** (Apache) with an optional **cPanel Nginx** layer in front of it. The reverse proxy goes in whichever layer faces the internet.

### Option A — Apache reverse proxy via WHM (recommended, always available)

This works regardless of whether cPanel Nginx is enabled.

1. **Create a subdomain** in cPanel → **Subdomains** → add `ares.yourdomain.com`

2. **SSH into the server** and create a custom Apache include for the subdomain:

```bash
# Replace USERNAME with the cPanel account username
# Replace ares.yourdomain.com with your actual subdomain
mkdir -p /home/USERNAME/public_html/ares/.well-known

cat > /etc/apache2/conf.d/userdata/ssl/2_4/USERNAME/ares.yourdomain.com/ares_proxy.conf <<'APACHE'
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:7000/
    ProxyPassReverse / http://127.0.0.1:7000/
    RequestHeader    set X-Forwarded-Proto "https"
</IfModule>
APACHE

# Also add for non-SSL vhost
cat > /etc/apache2/conf.d/userdata/2_4/USERNAME/ares.yourdomain.com/ares_proxy.conf <<'APACHE'
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:7000/
    ProxyPassReverse / http://127.0.0.1:7000/
    RequestHeader    set X-Forwarded-Proto "http"
</IfModule>
APACHE

# Rebuild Apache config and reload
/scripts/rebuildhttpdconf
systemctl reload httpd
```

3. **Enable mod_proxy** if not already on:
   - WHM → **Service Configuration** → **Apache Configuration** → **Global Configuration**
   - Ensure `mod_proxy` and `mod_proxy_http` are enabled, then save and rebuild.

### Option B — WHM cPanel Nginx reverse proxy (if cPanel Nginx is enabled)

If you have cPanel Nginx active (WHM → **cPanel Nginx Reverse Proxy Manager**):

1. In WHM → **cPanel Nginx Reverse Proxy Manager** → select the user/domain
2. Enable **"Proxy subdomains through Nginx"**
3. Add a custom Nginx include:

```bash
cat > /etc/nginx/conf.d/ares_proxy.conf <<'NGINX'
server {
    listen      80;
    server_name ares.yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:7000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade     $http_upgrade;
        proxy_set_header   Connection  'upgrade';
        proxy_set_header   Host        $host;
        proxy_set_header   X-Real-IP   $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

nginx -t && systemctl reload nginx
```

### Open port 7000 in CSF (cPanel's firewall)

If CSF is installed (standard on most cPanel servers):

```bash
# Allow inbound TCP on the app port
csf -a tcp 7000
csf -r
```

Or in WHM → **ConfigServer Security & Firewall** → **Firewall Configuration** → find **TCP_IN** → append `,7000` → **Change** → **Restart csf+lfd**.

> **Note:** Port 7000 only needs to be open if you are accessing A.R.E.S. directly by IP+port. If you use a reverse proxy (recommended), keep port 7000 blocked from the internet — only the local Nginx/Apache needs to reach it.

---

## Publishing — Going Live at a Domain

After the installer confirms A.R.E.S. is healthy, follow these steps to make it reachable at `https://ares.yourdomain.com` instead of a raw IP and port.

### Step 1 — Point your domain to the server

Log into your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.) and add an **A record**:

| Host | Type | Value | TTL |
|------|------|-------|-----|
| `ares` | A | `YOUR_SERVER_IP` | 300 |

This makes `ares.yourdomain.com` resolve to your server's IP. DNS propagation typically takes 5–15 minutes, occasionally up to an hour.

Check it has propagated:
```bash
dig +short ares.yourdomain.com
# Should return your server IP
```

### Step 2 — Set up a reverse proxy

A reverse proxy sits on ports 80/443 and forwards traffic to A.R.E.S. running on its internal port. Choose the guide that matches your setup:

| Server setup | Guide |
|---|---|
| No control panel (bare VPS) | [CWP Nginx section](#setting-up-a-reverse-proxy-in-cwp) — use "Manual Nginx config" |
| CWP | [CWP reverse proxy section](#setting-up-a-reverse-proxy-in-cwp) |
| cPanel / WHM | [cPanel reverse proxy section](#setting-up-a-reverse-proxy-in-cpanel--whm) |

**Quick setup for a bare Rocky Linux / AlmaLinux VPS (no control panel):**

```bash
dnf install -y nginx
systemctl enable --now nginx

cat > /etc/nginx/conf.d/ares.conf <<'NGINX'
server {
    listen 80;
    server_name ares.yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade     $http_upgrade;
        proxy_set_header   Connection  'upgrade';
        proxy_set_header   Host        $host;
        proxy_set_header   X-Real-IP   $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

nginx -t && systemctl reload nginx
```

Replace `8080` with the port in your `.env` if you changed it.

**Quick setup for a bare Ubuntu / Debian VPS:**

```bash
apt install -y nginx

cat > /etc/nginx/sites-available/ares <<'NGINX'
server {
    listen 80;
    server_name ares.yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade     $http_upgrade;
        proxy_set_header   Connection  'upgrade';
        proxy_set_header   Host        $host;
        proxy_set_header   X-Real-IP   $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/ares /etc/nginx/sites-enabled/ares
nginx -t && systemctl reload nginx
```

### Step 3 — Issue a free SSL certificate

Once your domain is resolving correctly and Nginx is serving port 80, issue a certificate with Certbot.

**Rocky Linux / AlmaLinux:**
```bash
dnf install -y certbot python3-certbot-nginx
certbot --nginx -d ares.yourdomain.com
```

**Ubuntu / Debian:**
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ares.yourdomain.com
```

Certbot automatically edits the Nginx config to redirect HTTP → HTTPS and reloads Nginx. Certificates auto-renew via a systemd timer or cron job installed by Certbot.

For cPanel, use AutoSSL instead — see [Enabling HTTPS → cPanel AutoSSL](#enabling-https).

### Step 4 — Tell A.R.E.S. it is behind HTTPS

Open `/opt/ares/.env` and set the public URL so session cookies and API links work correctly:

```bash
nano /opt/ares/.env
```

Add or update:
```
PUBLIC_URL=https://ares.yourdomain.com
NODE_ENV=production
```

Restart the containers to pick up the change:
```bash
docker compose -f /opt/ares/docker-compose.yml up -d
```

### Step 5 — Verify end-to-end

```bash
curl -I https://ares.yourdomain.com/api/healthz
# Expected: HTTP/2 200
```

Open `https://ares.yourdomain.com` in your browser and log in with `admin@admin.local` / `Password%1`. **Change the admin password immediately.**

---

## Enabling HTTPS

### cPanel — AutoSSL (easiest)

cPanel's AutoSSL provisions free Let's Encrypt certificates automatically for all subdomains under cPanel accounts.

1. In WHM → **Manage AutoSSL** → confirm Let's Encrypt provider is selected
2. In the cPanel account → **SSL/TLS** → **AutoSSL** → run AutoSSL for the account
3. The certificate for `ares.yourdomain.com` will be issued within minutes

### Ubuntu / Debian (no cPanel)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ares.yourdomain.com
```

### AlmaLinux / RHEL (no cPanel)

```bash
dnf install -y certbot python3-certbot-nginx
certbot --nginx -d ares.yourdomain.com
```

### CWP — built-in Let's Encrypt manager

CWP Admin → **SSL** → **Manage SSL** → select subdomain → **Issue Let's Encrypt Certificate**

---

## Updating A.R.E.S.

```bash
sudo bash /opt/ares/docker-update.sh
```

Works on all platforms (Ubuntu, AlmaLinux, cPanel). Pulls latest code, rebuilds with `--no-cache`, restarts, and health-checks. Your `.env` and database data are preserved.

---

## Useful Commands

```bash
# Live application logs
docker compose -f /opt/ares/docker-compose.yml logs -f app

# Live database logs
docker compose -f /opt/ares/docker-compose.yml logs -f db

# Container status
docker compose -f /opt/ares/docker-compose.yml ps

# Restart app only
docker compose -f /opt/ares/docker-compose.yml restart app

# Stop everything
docker compose -f /opt/ares/docker-compose.yml down

# Start everything
docker compose -f /opt/ares/docker-compose.yml up -d

# Shell inside the app container
docker compose -f /opt/ares/docker-compose.yml exec app sh
```

---

## Troubleshooting

### App won't start / health check fails

```bash
docker compose -f /opt/ares/docker-compose.yml logs app
```

The most common cause is a database password mismatch between `.env` and the running database container (e.g. after changing `POSTGRES_PASSWORD`).

**Fix — wipe DB volume and reinstall:**
```bash
docker compose -f /opt/ares/docker-compose.yml down -v
sudo bash install-cpanel.sh   # or install.sh / install-almalinux.sh
```

---

### Build fails with "exit code: 1"

```bash
cd /opt/ares
docker compose build --no-cache 2>&1 | cat
```

Scroll up to find the **first** `ERROR` line — the summary at the bottom only echoes the exit code, not the cause.

---

### Port already in use

```bash
ss -tlnp | grep 7000
```

Edit `/opt/ares/.env`, change `PORT=` to a free port, then restart:

```bash
docker compose -f /opt/ares/docker-compose.yml down
docker compose -f /opt/ares/docker-compose.yml up -d
```

---

### 502 Bad Gateway from Apache/Nginx reverse proxy

Apache needs `mod_proxy` enabled. Check in WHM → **Apache Configuration** → **Global Configuration**.

Also check SELinux (AlmaLinux / cPanel):
```bash
setsebool -P httpd_can_network_connect 1
```

---

### Docker containers can't reach the internet (cPanel + CSF)

When `"iptables": false` is set in Docker's daemon config (the cPanel installer does this), Docker containers use the host network stack but CSF must allow forwarding.

In `/etc/csf/csf.conf`, ensure:
```
DOCKER = "1"
```

Then restart CSF:
```bash
csf -r
```

If the `DOCKER` option is missing from your CSF version, add these lines to `/etc/csf/csfpost.sh`:

```bash
DOCKER_INT="docker0"
iptables -A FORWARD -i $DOCKER_INT -j ACCEPT
iptables -A FORWARD -o $DOCKER_INT -j ACCEPT
iptables -t nat -A POSTROUTING -s 172.17.0.0/16 ! -o $DOCKER_INT -j MASQUERADE
```

Then run:
```bash
csf -r
```

---

### CWP blocks connections to Docker containers

If Nginx can't reach `127.0.0.1:3000` via the reverse proxy:

```bash
echo "127.0.0.1" >> /etc/csf/csf.allow
csf -r
```

---

### SELinux blocks Nginx reverse proxy (AlmaLinux / RHEL)

```bash
setsebool -P httpd_can_network_connect 1
```

---

### App shows blank page after changing port or domain

Hard-refresh the browser to clear cached resources:

```
Ctrl + Shift + R   (Windows / Linux)
Cmd  + Shift + R   (Mac)
```
