/**
 * Delete all stored positions for one IMEI and clear its last-fix snapshot.
 *
 * Usage:
 *   node scripts/clear-imei-positions.js --imei 868022030666528
 *   SQLITE_PATH=/var/lib/petpal/petpal.sqlite node scripts/clear-imei-positions.js --imei …
 */
const path = require("path");
const { openSqlite } = require("../src/db/sqlite");

function parseArgs(argv) {
  const out = { imei: null, db: process.env.SQLITE_PATH || null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--imei" || a === "-i") out.imei = argv[++i];
    else if (a === "--db") out.db = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (!a.startsWith("-") && !out.imei) out.imei = a;
  }
  return out;
}

function main() {
  const { imei, db, dryRun } = parseArgs(process.argv);
  const imeiKey = String(imei || "").trim();
  if (!/^\d{10,20}$/.test(imeiKey)) {
    console.error("Usage: node clear-imei-positions.js --imei <10-20 digits> [--db path] [--dry-run]");
    process.exit(1);
  }

  const dbPath =
    db ||
    process.env.PETPAL_TRACKER_DB ||
    path.join(__dirname, "..", "data", "petpal.sqlite");

  const sqlite = openSqlite(dbPath);
  const before = sqlite.db.prepare("SELECT COUNT(*) AS n FROM positions WHERE imei = ?").get(imeiKey).n;
  const device = sqlite.getDevice.get(imeiKey);

  console.log(
    JSON.stringify(
      {
        db: dbPath,
        imei: imeiKey,
        positionsBefore: before,
        deviceExists: Boolean(device),
        dryRun,
      },
      null,
      2
    )
  );

  if (dryRun) {
    sqlite.db.close();
    return;
  }

  const delPos = sqlite.db.prepare("DELETE FROM positions WHERE imei = ?");
  const clearLast = sqlite.db.prepare(`
    UPDATE devices
    SET last_lat = NULL, last_lng = NULL, source = NULL, last_update = NULL
    WHERE imei = ?
  `);
  const tx = sqlite.db.transaction(() => {
    const info = delPos.run(imeiKey);
    clearLast.run(imeiKey);
    return info.changes;
  });
  const deleted = tx();
  const after = sqlite.db.prepare("SELECT COUNT(*) AS n FROM positions WHERE imei = ?").get(imeiKey).n;
  sqlite.db.close();

  console.log(JSON.stringify({ ok: true, deleted, positionsAfter: after }, null, 2));
}

main();
