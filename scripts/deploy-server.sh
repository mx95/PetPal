#!/usr/bin/env bash
# Deploy PetPal on the Hetzner tracker host (SPA build + PM2 tracker restart).
# Run manually on the server or via GitHub Actions SSH.
set -euo pipefail

PETPAL_ROOT="${PETPAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
HTTP_PORT="${HTTP_PORT:-5002}"
PM2_APP="${PM2_APP:-tracker}"
SKIP_GIT="${SKIP_GIT:-0}"

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

needs_npm_ci() {
  local dir="$1"
  [ ! -d "$dir/node_modules" ] && return 0
  [ ! -f "$dir/package-lock.json" ] && return 0
  [ "$dir/package-lock.json" -nt "$dir/node_modules" ] && return 0
  return 1
}

if [ "$SKIP_GIT" != "1" ]; then
  log "Updating repo at $PETPAL_ROOT (branch: $DEPLOY_BRANCH)"
  cd "$PETPAL_ROOT"
  git fetch origin "$DEPLOY_BRANCH"
  git checkout "$DEPLOY_BRANCH"
  git reset --hard "origin/$DEPLOY_BRANCH"
  log "Now at $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
fi

PETPAL_DIR="$PETPAL_ROOT/petpal"
TRACKER_DIR="$PETPAL_ROOT/tracker-tcp-server"

[ -d "$PETPAL_DIR" ] || die "Missing $PETPAL_DIR"
[ -d "$TRACKER_DIR" ] || die "Missing $TRACKER_DIR"

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

if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  log "Restarting pm2:$PM2_APP"
  pm2 restart "$PM2_APP"
else
  log "Starting pm2:$PM2_APP from ecosystem.config.cjs"
  pm2 start ecosystem.config.cjs
  pm2 save
fi

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

log "Deploy OK — $(curl -sf "http://127.0.0.1:${HTTP_PORT}/api/app/devices" | head -c 120)…"
log "Tip: hard-refresh the browser (Ctrl+F5) to load the new JS bundle."
