#!/usr/bin/env bash
# One-time (idempotent) nginx setup for PetPal deploy maintenance page.
# Run on the Hetzner host as root:
#   cd ~/PetPal && sudo bash scripts/install-nginx-maintenance.sh
set -euo pipefail

DOMAIN="${PETPAL_DOMAIN:-petpal.com.cy}"
SITE="/etc/nginx/sites-available/${DOMAIN}"
SNIPPET="/etc/nginx/snippets/petpal-maintenance.conf"
MARKER="# PetPal maintenance"

log() { printf '[install-nginx-maintenance] %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  log "Re-run with sudo: sudo bash scripts/install-nginx-maintenance.sh"
  exit 1
fi

if [ ! -f "$SITE" ]; then
  log "Missing nginx site config: $SITE"
  log "Run scripts/setup-nginx-domain.sh first."
  exit 1
fi

log "Writing $SNIPPET"
mkdir -p /etc/nginx/snippets
cat > "$SNIPPET" <<'EOF'
# PetPal maintenance — managed by scripts/install-nginx-maintenance.sh
error_page 502 503 @petpal_maintenance;

location @petpal_maintenance {
    root /var/lib/petpal/maintenance;
    try_files /maintenance.html =503;
    default_type text/html;
    add_header Retry-After 60 always;
    add_header Cache-Control "no-store, no-cache, must-revalidate" always;
}
EOF

if ! grep -qF "$SNIPPET" "$SITE"; then
  log "Adding snippet include to each server block in $SITE"
  awk -v snippet="$SNIPPET" '
    /^[[:space:]]*server[[:space:]]*\{/ { in_server=1; include_done=0 }
    in_server && /^[[:space:]]*server_name/ && !include_done {
      print
      print "    include " snippet ";"
      include_done=1
      next
    }
    /^[[:space:]]*\}/ && in_server { in_server=0 }
    { print }
  ' "$SITE" > "${SITE}.tmp"
  mv "${SITE}.tmp" "$SITE"
fi

if ! grep -qF "$MARKER" "$SITE"; then
  log "Patching location / blocks in $SITE"
  awk -v marker="$MARKER" '
    /^[[:space:]]*location \/ \{/ {
      print $0
      print "        " marker
      print "        if (-f /var/lib/petpal/maintenance.enabled) {"
      print "            return 503;"
      print "        }"
      print "        proxy_intercept_errors on;"
      next
    }
    { print }
  ' "$SITE" > "${SITE}.tmp"
  mv "${SITE}.tmp" "$SITE"
fi

nginx -t
systemctl reload nginx
log "nginx maintenance routing installed OK"
