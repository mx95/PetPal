#!/usr/bin/env bash
# Build signed release AAB into releases/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f signing/keystore.properties ]]; then
  echo "Missing signing/keystore.properties — copy from signing/keystore.properties.example"
  exit 1
fi

if [[ ! -f local.properties ]]; then
  if [[ -z "${ANDROID_HOME:-}" ]]; then
    echo "Create local.properties (see local.properties.example) or set ANDROID_HOME"
    exit 1
  fi
  printf 'sdk.dir=%s\n' "$ANDROID_HOME" > local.properties
fi

echo "[build] Sync web assets from petpal/ (run from repo root if this fails)"
(cd ../petpal && npm run build:mobile) || true

echo "[build] Gradle bundleRelease"
./gradlew bundleRelease

VERSION_NAME=$(grep versionName app/build.gradle | head -1 | sed 's/.*"\(.*\)".*/\1/')
OUT="releases/petpal-${VERSION_NAME}-release.aab"
mkdir -p releases
cp app/build/outputs/bundle/release/app-release.aab "$OUT"
echo "[build] Done: $OUT"
