#!/usr/bin/env bash
# PetPal deploy maintenance helpers (nginx flag file + static page).
set -euo pipefail

PETPAL_ROOT="${PETPAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MAINTENANCE_DIR="${PETPAL_MAINTENANCE_DIR:-/var/lib/petpal/maintenance}"
MAINTENANCE_FLAG="${PETPAL_MAINTENANCE_FLAG:-/var/lib/petpal/maintenance.enabled}"
MAINTENANCE_HTML_SRC="$PETPAL_ROOT/scripts/maintenance/maintenance.html"

maintenance_log() {
  printf '[maintenance] %s\n' "$*"
}

maintenance_install_assets() {
  [ -f "$MAINTENANCE_HTML_SRC" ] || {
    maintenance_log "Missing $MAINTENANCE_HTML_SRC"
    return 1
  }
  mkdir -p "$MAINTENANCE_DIR"
  cp "$MAINTENANCE_HTML_SRC" "$MAINTENANCE_DIR/maintenance.html"
  chmod 644 "$MAINTENANCE_DIR/maintenance.html"
}

maintenance_enable() {
  maintenance_install_assets
  mkdir -p "$(dirname "$MAINTENANCE_FLAG")"
  touch "$MAINTENANCE_FLAG"
  maintenance_log "ON — visitors see maintenance page"
}

maintenance_disable() {
  rm -f "$MAINTENANCE_FLAG"
  maintenance_log "OFF — live site restored"
}

maintenance_is_enabled() {
  [ -f "$MAINTENANCE_FLAG" ]
}
