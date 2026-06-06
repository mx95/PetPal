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

if [ "$SKIP_GIT" != "1" ]; then
  log "Updating repo at $PETPAL_ROOT (branch: $DEPLOY_BRANCH)"
  cd "$PETPAL_ROOT"
  git fetch origin "$DEPLOY_BRANCH"
  git checkout "$DEPLOY_BRANCH"
  git reset --hard "origin/$DEPLOY_BRANCH"
  log "Now at $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
  restore_tracker_db_if_needed "$positions_before"
fi

if [ ! -f "$PETPAL_DIR/.env.local" ]; then
  die "Missing petpal/.env.local on server — create it before deploy (Firebase + REACT_APP_XEXUN_HTTP_BASE_URL=same)."
fi

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
log "Deploy OK — tracker DB: $TRACKER_DB ($positions_after position rows)"
log "Tip: hard-refresh the browser (Ctrl+F5) to load the new JS bundle."
