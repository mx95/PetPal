#!/usr/bin/env bash
# Deploy PetPal on the Hetzner tracker host (SPA build + PM2 tracker reload).
# Run manually on the server or via GitHub Actions SSH.
set -euo pipefail

PETPAL_ROOT="${PETPAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
HTTP_PORT="${HTTP_PORT:-5002}"
PM2_APP="${PM2_APP:-tracker}"
SKIP_GIT="${SKIP_GIT:-0}"
TRACKER_DB="${PETPAL_TRACKER_DB:-/var/lib/petpal/petpal.sqlite}"
LEGACY_DB="${PETPAL_LEGACY_DB:-$PETPAL_ROOT/tracker-tcp-server/data/petpal.sqlite}"

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

# shellcheck source=maintenance/maintenance.sh
source "$PETPAL_ROOT/scripts/maintenance/maintenance.sh"

ensure_nginx_maintenance_routing() {
  if [ "$(id -u)" -ne 0 ]; then
    log "Skipping nginx maintenance install (not root — run once: sudo bash scripts/install-nginx-maintenance.sh)"
    return 0
  fi
  if ! command -v nginx >/dev/null 2>&1; then
    log "Skipping nginx maintenance install (nginx not installed)"
    return 0
  fi
  if bash "$PETPAL_ROOT/scripts/install-nginx-maintenance.sh"; then
    log "nginx maintenance routing ready"
  else
    log "nginx maintenance install skipped or failed — deploy continues"
  fi
}

maintenance_trap_disable() {
  maintenance_disable || true
}

needs_npm_ci() {
  local dir="$1"
  [ ! -d "$dir/node_modules" ] && return 0
  [ ! -f "$dir/package-lock.json" ] && return 0
  [ "$dir/package-lock.json" -nt "$dir/node_modules" ] && return 0
  return 1
}

db_file_size() {
  local f="$1"
  [ -f "$f" ] || { echo 0; return; }
  stat -c%s "$f" 2>/dev/null || stat -f%z "$f"
}

count_positions() {
  local db="$1"
  [ -f "$db" ] || { echo 0; return; }
  sqlite3 "$db" "SELECT COUNT(*) FROM positions;" 2>/dev/null || echo 0
}

pick_best_db_candidate() {
  local best="" best_size=0 size candidate
  for candidate in "$TRACKER_DB" "$LEGACY_DB" "$PETPAL_ROOT/tracker-tcp-server/data/backups"/petpal-*.sqlite; do
    [ -f "$candidate" ] || continue
    size="$(db_file_size "$candidate")"
    if [ "$size" -gt "$best_size" ]; then
      best="$candidate"
      best_size="$size"
    fi
  done
  [ -n "$best" ] && printf '%s\n' "$best"
}

ensure_tracker_db() {
  mkdir -p "$(dirname "$TRACKER_DB")"
  if [ -f "$TRACKER_DB" ]; then
    log "Tracker DB: $TRACKER_DB ($(count_positions "$TRACKER_DB") positions)"
    return
  fi

  local source
  source="$(pick_best_db_candidate || true)"
  if [ -n "$source" ] && [ "$(db_file_size "$source")" -gt 8192 ]; then
    log "Initializing tracker DB at $TRACKER_DB from $source"
    cp "$source" "$TRACKER_DB"
    rm -f "${TRACKER_DB}-wal" "${TRACKER_DB}-shm" 2>/dev/null || true
  else
    log "Tracker DB will be created on first tracker start: $TRACKER_DB"
  fi
}

backup_tracker_db() {
  local db="$TRACKER_DB"
  [ -f "$db" ] || db="$LEGACY_DB"
  [ -f "$db" ] || return 0
  log "Backing up tracker DB before deploy"
  SQLITE_PATH="$db" bash "$PETPAL_ROOT/tracker-tcp-server/scripts/backup-sqlite.sh"
}

restore_tracker_db_if_needed() {
  local before="${1:-0}"
  local after
  after="$(count_positions "$TRACKER_DB")"
  if [ "$after" -ge "$before" ]; then
    log "Tracker DB OK after git update ($after positions)"
    return
  fi

  local latest=""
  latest="$(ls -1t "$PETPAL_ROOT/tracker-tcp-server/data/backups"/petpal-*.sqlite 2>/dev/null | head -1 || true)"
  if [ -z "$latest" ]; then
    die "Tracker DB position count dropped ($before → $after) and no backup found"
  fi

  log "Restoring tracker DB from $latest ($before → $after positions before restore)"
  cp "$latest" "$TRACKER_DB"
  rm -f "${TRACKER_DB}-wal" "${TRACKER_DB}-shm" 2>/dev/null || true
  log "Restored tracker DB ($(count_positions "$TRACKER_DB") positions)"
}

PETPAL_DIR="$PETPAL_ROOT/petpal"
TRACKER_DIR="$PETPAL_ROOT/tracker-tcp-server"

[ -d "$PETPAL_DIR" ] || die "Missing $PETPAL_DIR"
[ -d "$TRACKER_DIR" ] || die "Missing $TRACKER_DIR"

ensure_tracker_db
positions_before="$(count_positions "$TRACKER_DB")"
backup_tracker_db

ensure_nginx_maintenance_routing
trap maintenance_trap_disable EXIT
maintenance_enable

if [ "$SKIP_GIT" != "1" ]; then
  log "Updating repo at $PETPAL_ROOT (branch: $DEPLOY_BRANCH)"
  bash "$PETPAL_ROOT/scripts/git-sync-server.sh" "$PETPAL_ROOT" "$DEPLOY_BRANCH"
  restore_tracker_db_if_needed "$positions_before"
  # Mobile native projects are separate GitLab repos — not served by the tracker.
  rm -rf "$PETPAL_ROOT/mobile-android" "$PETPAL_ROOT/mobile-ios" "$PETPAL_ROOT/export" 2>/dev/null || true
fi

if [ ! -f "$PETPAL_DIR/.env.local" ]; then
  die "Missing petpal/.env.local on server — create it before deploy (Firebase + REACT_APP_XEXUN_HTTP_BASE_URL=same)."
fi

disable_business_demo_account() {
  local marker="/var/lib/petpal/business-demo-account.disabled"
  local script="$PETPAL_DIR/scripts/disable-demo-business.cjs"
  [ -f "$script" ] || return 0
  if [ -f "$marker" ]; then
    log "Business demo account already disabled ($marker)"
    return 0
  fi
  log "Disabling business demo account (hide from Bookings / Nearby)"
  mkdir -p "$(dirname "$marker")"
  cd "$PETPAL_DIR"
  export FIREBASE_PROJECT_ID=petpal-aecda
  export BIZ_EMAIL=business.demo@petpal.com.cy
  export DELETE_DEMO=0
  if [ -f /root/serviceAccount.json ]; then
    export GOOGLE_APPLICATION_CREDENTIALS=/root/serviceAccount.json
  elif [ -f "$PETPAL_DIR/serviceAccount.json" ]; then
    export GOOGLE_APPLICATION_CREDENTIALS="$PETPAL_DIR/serviceAccount.json"
  fi
  if node scripts/disable-demo-business.cjs; then
    touch "$marker"
    # Stop future deploys from re-seeding the old one-time demo account.
    touch /var/lib/petpal/business-demo-account.seeded 2>/dev/null || true
    log "Business demo account disabled OK"
  else
    log "Business demo disable skipped or failed (Firebase Admin credentials may be missing on server)"
  fi
}

clear_broadcast_inbox_once() {
  local marker="/var/lib/petpal/broadcast-inbox-cleared-2026-08-21b"
  local script="$PETPAL_DIR/scripts/clear-broadcast-inbox.cjs"
  [ -f "$script" ] || return 0
  if [ -f "$marker" ]; then
    log "Broadcast inbox already cleared ($marker)"
    return 0
  fi
  log "Clearing broadcast inbox messages for all users"
  mkdir -p "$(dirname "$marker")"
  cd "$PETPAL_DIR"
  export FIREBASE_PROJECT_ID=petpal-aecda
  if [ -f /root/serviceAccount.json ]; then
    export GOOGLE_APPLICATION_CREDENTIALS=/root/serviceAccount.json
  elif [ -f "$PETPAL_DIR/serviceAccount.json" ]; then
    export GOOGLE_APPLICATION_CREDENTIALS="$PETPAL_DIR/serviceAccount.json"
  fi
  if node scripts/clear-broadcast-inbox.cjs; then
    touch "$marker"
    log "Broadcast inbox cleared OK"
  else
    log "Broadcast inbox clear skipped or failed (Firebase Admin credentials may be missing on server)"
  fi
}

disable_business_demo_account
clear_broadcast_inbox_once

deploy_firebase_cli() {
  if command -v firebase >/dev/null 2>&1; then
    printf '%s\n' firebase
    return
  fi
  printf '%s\n' "npx firebase-tools@13.29.1"
}

read_places_api_key() {
  local key=""
  if [ -f /var/lib/petpal/places-api-key ]; then
    key="$(tr -d '\r\n' < /var/lib/petpal/places-api-key)"
  fi
  if [ -z "$key" ] && [ -f "$PETPAL_DIR/.env.local" ]; then
    key="$(grep -E '^GOOGLE_PLACES_API_KEY=' "$PETPAL_DIR/.env.local" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^["'\'' ]*//;s/["'\'' ]*$//' | tr -d '\r')"
  fi
  printf '%s' "$key"
}

configure_places_functions_config() {
  local key fb
  key="$(read_places_api_key)"
  [ -n "$key" ] || {
    log "No GOOGLE_PLACES_API_KEY — skip Nearby Places functions.config (see scripts/configure-places-api-key.sh)"
    return 0
  }

  local sa=""
  if [ -f /root/serviceAccount.json ]; then
    sa=/root/serviceAccount.json
  elif [ -f "$PETPAL_DIR/serviceAccount.json" ]; then
    sa="$PETPAL_DIR/serviceAccount.json"
  fi

  fb="$(deploy_firebase_cli)"
  cd "$PETPAL_DIR"
  if [ -n "$sa" ]; then
    export GOOGLE_APPLICATION_CREDENTIALS="$sa"
  elif ! $fb projects:list --project petpal-aecda --non-interactive >/dev/null 2>&1; then
    log "Skipping places.key config (no Firebase credentials)"
    return 0
  fi

  log "Setting Firebase functions.config places.key for Nearby cache refresh"
  if $fb functions:config:set "places.key=${key}" --project petpal-aecda --non-interactive; then
    log "functions.config places.key OK"
  else
    log "functions.config places.key failed — run: bash scripts/configure-places-api-key.sh"
  fi
}

bootstrap_nearby_places_cache_if_needed() {
  local key sa marker
  key="$(read_places_api_key)"
  [ -n "$key" ] || {
    log "Nearby cache bootstrap skipped (no GOOGLE_PLACES_API_KEY on server)"
    return 0
  }

  marker="/var/lib/petpal/nearby-places-cache-ready"
  if [ -f "$marker" ] && [ "${FORCE_NEARBY_BOOTSTRAP:-0}" != "1" ]; then
    log "Nearby cache already bootstrapped ($marker)"
    return 0
  fi

  sa=""
  if [ -f /root/serviceAccount.json ]; then
    sa=/root/serviceAccount.json
  elif [ -f "$PETPAL_DIR/serviceAccount.json" ]; then
    sa="$PETPAL_DIR/serviceAccount.json"
  fi
  [ -n "$sa" ] || {
    log "Nearby cache bootstrap skipped (no serviceAccount.json)"
    return 0
  }

  export GOOGLE_APPLICATION_CREDENTIALS="$sa"
  export GOOGLE_PLACES_API_KEY="$key"
  log "Bootstrapping Nearby Places cache (CY + GR) — may take several minutes"
  if (cd "$PETPAL_DIR" && node scripts/bootstrap-nearby-places-cache.cjs); then
    mkdir -p /var/lib/petpal
    touch "$marker"
    log "Nearby Places cache bootstrap OK"
  else
    log "Nearby Places cache bootstrap failed — use Admin → Nearby places cache or bootstrap-nearby-places workflow"
  fi
}

deploy_firestore_rules() {
  local sa=""
  if [ -f /root/serviceAccount.json ]; then
    sa=/root/serviceAccount.json
  elif [ -f "$PETPAL_DIR/serviceAccount.json" ]; then
    sa="$PETPAL_DIR/serviceAccount.json"
  fi

  local fb
  fb="$(deploy_firebase_cli)"
  cd "$PETPAL_DIR"

  if [ -n "$sa" ]; then
    log "Deploying Firestore rules + indexes (service account)"
    export GOOGLE_APPLICATION_CREDENTIALS="$sa"
    if $fb deploy --only firestore:rules,firestore:indexes --project petpal-aecda --non-interactive; then
      log "Firestore rules deployed OK"
      return 0
    fi
    log "Firestore rules deploy via service account failed — trying Firebase CLI login"
    unset GOOGLE_APPLICATION_CREDENTIALS
  else
    log "No serviceAccount.json — trying Firebase CLI login on server"
  fi

  if $fb projects:list --project petpal-aecda --non-interactive >/dev/null 2>&1; then
    log "Deploying Firestore rules + indexes (firebase login)"
    if $fb deploy --only firestore:rules,firestore:indexes --project petpal-aecda --non-interactive; then
      log "Firestore rules deployed OK"
      return 0
    fi
    log "Firestore rules deploy failed"
    return 1
  fi

  log "Skipping Firestore rules deploy (no serviceAccount.json or firebase login on server)"
  return 0
}

deploy_firebase_functions() {
  local sa=""
  if [ -f /root/serviceAccount.json ]; then
    sa=/root/serviceAccount.json
  elif [ -f "$PETPAL_DIR/serviceAccount.json" ]; then
    sa="$PETPAL_DIR/serviceAccount.json"
  fi

  local fb
  fb="$(deploy_firebase_cli)"
  cd "$PETPAL_DIR"

  if [ -n "$sa" ]; then
    export GOOGLE_APPLICATION_CREDENTIALS="$sa"
  elif ! $fb projects:list --project petpal-aecda --non-interactive >/dev/null 2>&1; then
    log "Skipping Cloud Functions deploy (no Firebase credentials on server)"
    return 0
  fi

  log "Deploying shop Cloud Functions"
  cd "$PETPAL_DIR/functions"
  if needs_npm_ci "$(pwd)"; then
    npm ci
  fi
  cd "$PETPAL_DIR"
  if $fb deploy \
    --only functions:createJccCheckout,functions:createJccUpdateCard,functions:jccPaymentReturn,functions:billingRenewal,functions:expireProviderBoosts,functions:assignSubscriptionImei,functions:linkTrackerSubscriptionPet,functions:createCustomerBooking,functions:sendBookingConfirmation,functions:submitContactForm,functions:getSupportEmailStatus,functions:saveSupportSmtpConfig,functions:uploadShopAsset,functions:refreshNearbyPlacesCache,functions:bootstrapRefreshNearbyPlacesCache,functions:getNearbyPlacesCacheMeta \
    --project petpal-aecda \
    --non-interactive; then
    log "Cloud Functions deployed OK"
  else
    log "Cloud Functions deploy failed — run manually: cd petpal && npm run deploy:shop-functions"
  fi
}

deploy_firestore_rules
configure_places_functions_config
deploy_firebase_functions
bootstrap_nearby_places_cache_if_needed

ensure_firebase_auth_domain_for_redirect() {
  # Google OAuth must allow https://petpal.com.cy/__/auth/handler before we can
  # use authDomain=petpal.com.cy. Until that URI is registered in Google Cloud,
  # keep the working Firebase default or login fails with redirect_uri_mismatch.
  local envf="$PETPAL_DIR/.env.local"
  [ -f "$envf" ] || return 0
  local want="${PETPAL_FIREBASE_AUTH_DOMAIN:-petpal.com.cy}"
  if grep -qE "^REACT_APP_FIREBASE_AUTH_DOMAIN=${want//./\\.}\s*$" "$envf"; then
    log "Firebase authDomain already $want"
    return 0
  fi
  if grep -qE '^REACT_APP_FIREBASE_AUTH_DOMAIN=' "$envf"; then
    sed -i.bak "s|^REACT_APP_FIREBASE_AUTH_DOMAIN=.*|REACT_APP_FIREBASE_AUTH_DOMAIN=${want}|" "$envf"
    log "Set REACT_APP_FIREBASE_AUTH_DOMAIN=${want}"
  else
    printf '\nREACT_APP_FIREBASE_AUTH_DOMAIN=%s\n' "$want" >> "$envf"
    log "Appended REACT_APP_FIREBASE_AUTH_DOMAIN=${want}"
  fi
  if [ "$want" = "petpal.com.cy" ]; then
    log "NOTE: Google Cloud OAuth must include https://petpal.com.cy/__/auth/handler"
  fi
}

ensure_firebase_auth_domain_for_redirect

log "Building frontend"
cd "$PETPAL_DIR"
if needs_npm_ci "$PETPAL_DIR"; then
  log "npm ci (petpal)"
  npm ci
else
  log "Skipping npm ci (petpal) — lockfile unchanged"
fi
npm run build

log "Updating tracker backend"
cd "$TRACKER_DIR"
if needs_npm_ci "$TRACKER_DIR"; then
  log "npm ci (tracker-tcp-server)"
  npm ci
else
  log "Skipping npm ci (tracker-tcp-server) — lockfile unchanged"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  die "pm2 not found — install with: npm i -g pm2"
fi

if [ -f "$TRACKER_DIR/scripts/purge-flipped-latitude-positions.js" ]; then
  log "Purging sign-flipped southern-latitude history rows"
  (cd "$TRACKER_DIR" && SQLITE_PATH="$TRACKER_DB" node scripts/purge-flipped-latitude-positions.js)
fi

CLEAR_IMEI="${CLEAR_DEVICE_POSITIONS_IMEI:-}"
if [ -n "$CLEAR_IMEI" ]; then
  if [[ ! "$CLEAR_IMEI" =~ ^[0-9]{10,20}$ ]]; then
    die "CLEAR_DEVICE_POSITIONS_IMEI must be 10–20 digits (got: $CLEAR_IMEI)"
  fi
  log "Clearing all positions for IMEI $CLEAR_IMEI"
  (cd "$TRACKER_DIR" && SQLITE_PATH="$TRACKER_DB" node scripts/clear-imei-positions.js --imei "$CLEAR_IMEI")
fi

log "Starting pm2:$PM2_APP from ecosystem.config.cjs (DB: $TRACKER_DB)"
cd "$TRACKER_DIR"
# reload alone can keep stale SQLITE_PATH — delete+start ensures ecosystem env is applied
pm2 delete "$PM2_APP" 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

log "Waiting for HTTP :$HTTP_PORT"
ready=0
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${HTTP_PORT}/api/app/devices" >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" != "1" ]; then
  die "Tracker HTTP did not respond on :$HTTP_PORT — check: pm2 logs $PM2_APP --lines 40"
fi

positions_after="$(count_positions "$TRACKER_DB")"
maintenance_disable
trap - EXIT
log "Deploy OK — tracker DB: $TRACKER_DB ($positions_after position rows)"
log "Tip: hard-refresh the browser (Ctrl+F5) to load the new JS bundle."
log "Note: JCC shop checkout uses Firebase Cloud Functions — deploy separately with: cd petpal && npm run deploy:shop-functions"
