#!/usr/bin/env bash
# Export mobile-android/ and mobile-ios/ as standalone GitLab-ready repos (sibling folders).
# Usage: bash scripts/export-mobile-repos.sh [git-commit]
set -euo pipefail

PETPAL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMIT="${1:-}"
ANDROID_OUT="${ANDROID_OUT:-$PETPAL_ROOT/../petpal-android}"
IOS_OUT="${IOS_OUT:-$PETPAL_ROOT/../petpal-ios}"

if [ -z "$COMMIT" ]; then
  if [ -d "$PETPAL_ROOT/mobile-android" ]; then
    COMMIT="HEAD"
  else
    COMMIT="$(git -C "$PETPAL_ROOT" log -1 --format=%H -- mobile-android 2>/dev/null || true)"
    [ -n "$COMMIT" ] || die "No mobile-android in tree and no history — pass a commit: $0 <commit>"
  fi
fi

log() { printf '[export-mobile] %s\n' "$*"; }
die() { printf '[export-mobile] ERROR: %s\n' "$*" >&2; exit 1; }

export_one() {
  local subpath="$1"
  local outdir="$2"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  log "Extracting $subpath @ $COMMIT → $outdir"
  git -C "$PETPAL_ROOT" archive "$COMMIT" "$subpath" | tar -x -C "$tmp"
  mkdir -p "$outdir"
  shopt -s dotglob nullglob
  rm -rf "${outdir:?}/"*
  mv "$tmp/$subpath/"* "$outdir/"
  shopt -u dotglob nullglob
}

export_one mobile-android "$ANDROID_OUT"
export_one mobile-ios "$IOS_OUT"

# Standalone sync script (expects PetPal web app as sibling or PETPAL_WEB_DIR).
for repo in "$ANDROID_OUT" "$IOS_OUT"; do
  mkdir -p "$repo/scripts"
  cat > "$repo/scripts/sync-petpal-web.sh" <<'SYNC'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="${PETPAL_WEB_DIR:-$ROOT/../PetPal/petpal}"
WEB_BUILD_OUT="${WEB_BUILD_OUT:-$ROOT/web-app}"

if [ ! -f "$WEB_DIR/package.json" ]; then
  echo "Set PETPAL_WEB_DIR to the PetPal web app (petpal/ folder with package.json)"
  exit 1
fi

echo "[sync] Building web app in $WEB_DIR"
(cd "$WEB_DIR" && npm ci && npm run build:mobile:web)

rm -rf "$WEB_BUILD_OUT"
mkdir -p "$WEB_BUILD_OUT"
cp -a "$WEB_DIR/build/." "$WEB_BUILD_OUT/"

if [ -f "$ROOT/capacitor.config.json" ]; then
  node -e "
    const fs=require('fs');
    const p='$ROOT/capacitor.config.json';
    const j=JSON.parse(fs.readFileSync(p,'utf8'));
    j.webDir='web-app';
    fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');
  "
fi

if command -v npx >/dev/null 2>&1 && [ -f "$ROOT/package.json" ] || [ -f "$WEB_DIR/package.json" ]; then
  echo "[sync] cap sync"
  (cd "$ROOT" && npx --yes @capacitor/cli sync)
fi

echo "[sync] Done — web assets in $WEB_BUILD_OUT"
SYNC
  chmod +x "$repo/scripts/sync-petpal-web.sh"
done

cat > "$ANDROID_OUT/capacitor.config.json" <<'EOF'
{
  "appId": "io.petpal.app",
  "appName": "PetPal",
  "webDir": "web-app",
  "server": { "androidScheme": "https" }
}
EOF

cat > "$IOS_OUT/capacitor.config.json" <<'EOF'
{
  "appId": "io.petpal.app",
  "appName": "PetPal",
  "webDir": "web-app",
  "server": { "androidScheme": "https" }
}
EOF

log "Android repo ready: $ANDROID_OUT"
log "iOS repo ready:     $IOS_OUT"
log "Next: see docs/MOBILE_GITLAB.md — git init + push to GitLab"
