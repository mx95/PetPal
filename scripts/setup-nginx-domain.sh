#!/usr/bin/env bash
# nginx + Let's Encrypt for petpal.com.cy → PM2 tracker on :5002
# Run on the Hetzner host as root (or with sudo):
#   cd ~/PetPal && bash scripts/setup-nginx-domain.sh
set -euo pipefail

DOMAIN="${PETPAL_DOMAIN:-petpal.com.cy}"
WWW="${PETPAL_WWW:-www.petpal.com.cy}"
UPSTREAM_PORT="${HTTP_PORT:-5002}"
EMAIL="${PETPAL_LETSENCRYPT_EMAIL:-techmastercy1@gmail.com}"

log() { printf '[setup-nginx] %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  log "Re-run with sudo: sudo bash scripts/setup-nginx-domain.sh"
  exit 1
fi

log "Installing nginx + certbot (if missing)"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx

SITE="/etc/nginx/sites-available/${DOMAIN}"
log "Writing $SITE"
cat > "$SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW};

    # Firebase Auth redirect helpers (Google / Apple) — first-party on this domain.
    location /__/auth {
        proxy_pass https://petpal-aecda.firebaseapp.com;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_set_header Host petpal-aecda.firebaseapp.com;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${UPSTREAM_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf "$SITE" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t
systemctl enable nginx
systemctl reload nginx

log "Opening firewall (ufw) for web + collar TCP"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw allow 5001/tcp || true
  ufw allow 5003/tcp || true
  ufw --force enable || true
fi

log "Requesting TLS certificate for ${DOMAIN} and ${WWW}"
certbot --nginx -d "$DOMAIN" -d "$WWW" --non-interactive --agree-tos -m "$EMAIL" --redirect

log "Done. Test:"
log "  curl -sI https://${DOMAIN} | head -3"
log "  curl -s https://${DOMAIN}/api/app/devices | head -c 120"
log ""
log "Next: ensure petpal/.env.local has REACT_APP_XEXUN_HTTP_BASE_URL=same"
log "      then: cd ~/PetPal && bash scripts/deploy-server.sh"
