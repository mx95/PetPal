#!/usr/bin/env bash
# macOS + Xcode only — archive PetPal for App Store export.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WS="$ROOT/App/App.xcworkspace"
SCHEME="App"
ARCHIVE="$ROOT/releases/PetPal.xcarchive"
EXPORT_DIR="$ROOT/releases/export"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "iOS release builds require macOS with Xcode."
  exit 1
fi

if ! command -v xcodebuild >/dev/null; then
  echo "Install Xcode from the Mac App Store."
  exit 1
fi

echo "[ios] Sync web assets"
(cd "$ROOT/../petpal" && npm run build:mobile)

echo "[ios] pod install"
(cd "$ROOT/App" && pod install)

mkdir -p "$ROOT/releases"

echo "[ios] xcodebuild archive (configure signing in Xcode first)"
xcodebuild -workspace "$WS" -scheme "$SCHEME" -configuration Release \
  -archivePath "$ARCHIVE" \
  -destination 'generic/platform=iOS' \
  archive

cat > "$ROOT/releases/EXPORT_INSTRUCTIONS.md" <<'EOF'
# Export IPA for App Store

Archive created at `releases/PetPal.xcarchive`.

## Xcode (recommended)

1. Open Xcode → Window → Organizer
2. Select the archive → Distribute App → App Store Connect

## Command line (after configuring ExportOptions.plist with your team)

```bash
xcodebuild -exportArchive \
  -archivePath releases/PetPal.xcarchive \
  -exportPath releases/export \
  -exportOptionsPlist ExportOptions.plist
```

Create `ExportOptions.plist` with your `teamID` and `method` = `app-store`.
EOF

echo "[ios] Archive: $ARCHIVE"
echo "[ios] See releases/EXPORT_INSTRUCTIONS.md"
