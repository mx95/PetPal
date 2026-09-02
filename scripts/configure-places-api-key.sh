#!/usr/bin/env bash
# Configure Google Places server key for refreshNearbyPlacesCache (never commit the key).
set -euo pipefail

PETPAL_ROOT="${PETPAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PETPAL_DIR="${PETPAL_DIR:-$PETPAL_ROOT/petpal}"
PLACES_KEY_FILE="${PLACES_KEY_FILE:-/var/lib/petpal/places-api-key}"
PROJECT="${FIREBASE_PROJECT_ID:-petpal-aecda}"

log() { printf '[places-key] %s\n' "$*"; }
die() { printf '[places-key] ERROR: %s\n' "$*" >&2; exit 1; }

KEY="${1:-${GOOGLE_PLACES_API_KEY:-}}"
if [ -z "$KEY" ]; then
  die "Usage: GOOGLE_PLACES_API_KEY=... $0   OR   $0 YOUR_SERVER_PLACES_KEY"
fi

mkdir -p "$(dirname "$PLACES_KEY_FILE")"
printf '%s\n' "$KEY" > "$PLACES_KEY_FILE"
chmod 600 "$PLACES_KEY_FILE"
log "Wrote $PLACES_KEY_FILE"

ENVF="$PETPAL_DIR/.env.local"
if [ -f "$ENVF" ]; then
  if grep -qE '^GOOGLE_PLACES_API_KEY=' "$ENVF"; then
    sed -i.bak "s|^GOOGLE_PLACES_API_KEY=.*|GOOGLE_PLACES_API_KEY=${KEY}|" "$ENVF"
  else
    printf '\nGOOGLE_PLACES_API_KEY=%s\n' "$KEY" >> "$ENVF"
  fi
  log "Updated GOOGLE_PLACES_API_KEY in petpal/.env.local"
fi

if [ -f /root/serviceAccount.json ]; then
  export GOOGLE_APPLICATION_CREDENTIALS=/root/serviceAccount.json
elif [ -f "$PETPAL_DIR/serviceAccount.json" ]; then
  export GOOGLE_APPLICATION_CREDENTIALS="$PETPAL_DIR/serviceAccount.json"
fi

if command -v firebase >/dev/null 2>&1; then
  FB=firebase
else
  FB="npx --yes firebase-tools@15.28.2"
fi

cd "$PETPAL_DIR"
if $FB projects:list --project "$PROJECT" --non-interactive >/dev/null 2>&1; then
  $FB functions:config:set "places.key=${KEY}" --project "$PROJECT" --non-interactive
  log "Firebase functions.config places.key set on $PROJECT"
else
  log "Firebase CLI not authenticated — key saved to $PLACES_KEY_FILE only"
  log "Run again on the server after firebase login or with serviceAccount.json"
fi

log "Done"
