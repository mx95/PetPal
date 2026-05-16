#!/usr/bin/env bash
# Backup tracker GPS database (safe while server is running).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${SQLITE_PATH:-$ROOT/data/petpal.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/data/backups}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/petpal-$STAMP.sqlite"

if [[ ! -f "$DB" ]]; then
  echo "Database not found: $DB" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$OUT'"
else
  cp "$DB" "$OUT"
fi

# Keep last 14 daily-style backups (by filename sort)
ls -1t "$BACKUP_DIR"/petpal-*.sqlite 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "Backup written: $OUT"
ls -lh "$OUT"
