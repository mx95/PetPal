#!/usr/bin/env node
/**
 * Remove GPS history rows with southern-hemisphere latitude that are sign-flipped
 * Mediterranean fixes (e.g. Cyprus +34.97° stored as -34.97° near South Africa).
 *
 * Usage:
 *   SQLITE_PATH=/var/lib/petpal/petpal.sqlite node scripts/purge-flipped-latitude-positions.js
 *   node scripts/purge-flipped-latitude-positions.js --dry-run
 */
const path = require("path");
const { openSqlite } = require("../src/db/sqlite");

const dryRun = process.argv.includes("--dry-run");

function isFlippedMedFix(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la >= 0) return false;
  const absLat = Math.abs(la);
  return absLat >= 30 && absLat <= 42 && lo >= 25 && lo <= 40;
}

function resolveDbPath() {
  const raw = process.env.SQLITE_PATH || process.env.PETPAL_TRACKER_DB || "";
  if (raw.trim()) return raw.trim();
  return path.join(__dirname, "..", "data", "petpal.sqlite");
}

function main() {
  const dbPath = resolveDbPath();
  const sqlite = openSqlite(dbPath);
  const { db } = sqlite;

  const candidates = db
    .prepare(
      `SELECT id, imei, lat, lng, source, COALESCE(received_at, timestamp) AS ts
       FROM positions
       WHERE lat < 0 AND lng BETWEEN 25 AND 40`
    )
    .all();

  const toDelete = candidates.filter((r) => isFlippedMedFix(r.lat, r.lng));
  const byImei = new Map();
  for (const row of toDelete) {
    byImei.set(row.imei, (byImei.get(row.imei) || 0) + 1);
  }

  console.log(`DB: ${dbPath}`);
  console.log(`Flipped-latitude rows to remove: ${toDelete.length}`);
  for (const [imei, count] of byImei.entries()) {
    console.log(`  ${imei}: ${count}`);
  }

  if (dryRun) {
    console.log("Dry run — no changes written.");
    return;
  }

  if (toDelete.length === 0) {
    console.log("Nothing to purge.");
    return;
  }

  const del = db.prepare("DELETE FROM positions WHERE id = ?");
  const fixDevice = db.prepare(`
    UPDATE devices
    SET
      last_lat = (
        SELECT lat FROM positions
        WHERE imei = devices.imei AND lat IS NOT NULL AND lat > 0
        ORDER BY id DESC LIMIT 1
      ),
      last_lng = (
        SELECT lng FROM positions
        WHERE imei = devices.imei AND lng IS NOT NULL
        ORDER BY id DESC LIMIT 1
      ),
      last_update = (
        SELECT COALESCE(received_at, timestamp) FROM positions
        WHERE imei = devices.imei
        ORDER BY id DESC LIMIT 1
      )
    WHERE imei = ?
      AND last_lat < 0
      AND last_lng BETWEEN 25 AND 40
      AND ABS(last_lat) BETWEEN 30 AND 42
  `);
  const clearBadHome = db.prepare(`
    UPDATE devices
    SET home_lat = NULL, home_lng = NULL
    WHERE imei = ?
      AND home_lat < 0
      AND home_lng BETWEEN 25 AND 40
      AND ABS(home_lat) BETWEEN 30 AND 42
  `);

  const tx = db.transaction(() => {
    for (const row of toDelete) del.run(row.id);
    for (const imei of byImei.keys()) {
      fixDevice.run(imei);
      clearBadHome.run(imei);
    }
  });
  tx();

  console.log(`Purged ${toDelete.length} position row(s).`);
}

main();
