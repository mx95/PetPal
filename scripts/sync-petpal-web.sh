#!/usr/bin/env bash
# Used inside petpal-android / petpal-ios repos after export.
# Builds the PetPal web app and copies it into web-app/ for Capacitor.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

if command -v npx >/dev/null 2>&1; then
  echo "[sync] cap sync"
  (cd "$ROOT" && npx --yes @capacitor/cli sync)
fi

echo "[sync] Done — web assets in $WEB_BUILD_OUT"
