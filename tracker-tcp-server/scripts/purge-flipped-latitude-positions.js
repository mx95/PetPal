/**
 * Remove GPS history rows with southern-hemisphere latitude that are sign-flipped
 * Mediterranean fixes (e.g. Cyprus +34.97° stored as -34.97° near South Africa).
 */
const path = require("path");
const { openSqlite } = require("../src/db/sqlite");

function isFlippedMedFix(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la >= 0) return false;
  const absLat = Math.abs(la);
  return absLat >= 30 && absLat <= 42 && lo >= 25 && lo <= 40;
}

/**
 * @param {string} dbPath
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {{ deleted: number, byImei: Record<string, number> }}
 */
function purgeFlippedLatitudePositions(dbPath, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
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
  const byImei = {};
  for (const row of toDelete) {
    byImei[row.imei] = (byImei[row.imei] || 0) + 1;
  }

  if (!dryRun && toDelete.length > 0) {
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
      for (const imei of Object.keys(byImei)) {
        fixDevice.run(imei);
        clearBadHome.run(imei);
      }
    });
    tx();
  }

  return { deleted: toDelete.length, byImei };
}

function resolveDbPath() {
  const raw = process.env.SQLITE_PATH || process.env.PETPAL_TRACKER_DB || "";
  if (raw.trim()) return raw.trim();
  return path.join(__dirname, "..", "data", "petpal.sqlite");
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const dbPath = resolveDbPath();
  const result = purgeFlippedLatitudePositions(dbPath, { dryRun });

  console.log(`DB: ${dbPath}`);
  console.log(`Flipped-latitude rows to remove: ${result.deleted}`);
  for (const [imei, count] of Object.entries(result.byImei)) {
    console.log(`  ${imei}: ${count}`);
  }

  if (dryRun) {
    console.log("Dry run — no changes written.");
  } else if (result.deleted === 0) {
    console.log("Nothing to purge.");
  } else {
    console.log(`Purged ${result.deleted} position row(s).`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { purgeFlippedLatitudePositions, isFlippedMedFix };
