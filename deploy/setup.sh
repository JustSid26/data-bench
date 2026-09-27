#!/usr/bin/env bash
# One-shot setup for a fresh Ubuntu 24.04 EC2 instance. Run from the repo root
# on the instance:   sudo bash deploy/setup.sh
# Re-running it is safe: it rebuilds and restarts with the current checkout.
# Unattended: SITE_USER=demo SITE_PASSWORD=... bash deploy/setup.sh
set -euo pipefail

APP=/opt/databench
REPO="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> system packages"
apt-get update -y
apt-get install -y python3-venv python3-pip nginx apache2-utils curl rsync
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> code to $APP"
mkdir -p "$APP"
if [ "$REPO" != "$APP" ]; then
  rsync -a --delete --exclude node_modules --exclude .venv --exclude frontend/dist --exclude .git "$REPO/" "$APP/"
fi
chown -R ubuntu:ubuntu "$APP"

echo "==> python deps"
sudo -u ubuntu python3 -m venv "$APP/.venv"
sudo -u ubuntu "$APP/.venv/bin/pip" install --upgrade pip -q
sudo -u ubuntu "$APP/.venv/bin/pip" install -q -r "$APP/backend/requirements.txt"

echo "==> build the ui (the api serves frontend/dist at /)"
cd "$APP/frontend"
sudo -u ubuntu npm ci --no-audit --no-fund
sudo -u ubuntu npm run build

echo "==> password for the site"
# non-interactive when SITE_USER / SITE_PASSWORD are set (terraform user_data);
# otherwise ask once, and keep the existing file on re-runs
if [ -n "${SITE_USER:-}" ] && [ -n "${SITE_PASSWORD:-}" ]; then
  htpasswd -bc /etc/nginx/databench.htpasswd "$SITE_USER" "$SITE_PASSWORD"
elif [ ! -f /etc/nginx/databench.htpasswd ]; then
  read -rp "username for the site: " SITE_USER
  htpasswd -c /etc/nginx/databench.htpasswd "$SITE_USER"
fi

echo "==> storage"
# with a bucket, uploads and results are kept in S3 (credentials come from the
# instance's IAM role). re-runs without the variables keep the existing file
if [ -n "${DATABENCH_BUCKET:-}" ]; then
  printf 'DATABENCH_BUCKET=%s\nAWS_DEFAULT_REGION=%s\n' "$DATABENCH_BUCKET" "${AWS_REGION:-ap-south-1}" > /etc/databench.env
fi
[ -f /etc/databench.env ] && cat /etc/databench.env || echo "no bucket configured -- datasets stay in memory only"

echo "==> keep the app's shared memory"
# logind deletes a regular user's IPC objects when its last ssh session ends,
# which pulls locks out from under running training jobs (the app trains on
# threads now, this is belt and braces)
mkdir -p /etc/systemd/logind.conf.d
printf '[Login]\nRemoveIPC=no\n' > /etc/systemd/logind.conf.d/databench.conf
systemctl restart systemd-logind

echo "==> services"
cp "$APP/deploy/databench.service" /etc/systemd/system/databench.service
cp "$APP/deploy/nginx.conf" /etc/nginx/sites-available/databench
ln -sf /etc/nginx/sites-available/databench /etc/nginx/sites-enabled/databench
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now databench
systemctl restart databench nginx

sleep 2
curl -fsS http://127.0.0.1:8000/api/health && echo
echo "==> done. open http://<this instance's public ip>/"
