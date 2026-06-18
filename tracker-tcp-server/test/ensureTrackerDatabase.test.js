const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");

const {
  ensureCanonicalDatabase,
  countPositionsInFile,
} = require("../src/db/ensureTrackerDatabase");

function seedDb(filePath, rowCount) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imei TEXT,
      lat REAL,
      lng REAL,
      source TEXT,
      battery INTEGER,
      signal INTEGER,
      timestamp TEXT,
      received_at TEXT
    );
  `);
  const insert = db.prepare(
    "INSERT INTO positions (imei, lat, lng, source, timestamp, received_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (let i = 0; i < rowCount; i += 1) {
    insert.run("123456789012345", 35 + i * 0.001, 33 + i * 0.001, "gps", new Date().toISOString(), new Date().toISOString());
  }
  db.close();
}

test("ensureCanonicalDatabase restores from legacy when canonical is empty", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "petpal-db-"));
  const legacy = path.join(root, "data", "petpal.sqlite");
  const canonical = path.join(root, "live", "petpal.sqlite");
  seedDb(legacy, 12);
  seedDb(canonical, 0);

  const result = ensureCanonicalDatabase(root, canonical);
  assert.equal(result.restoredFrom, legacy);
  assert.ok(countPositionsInFile(canonical) >= 12);
});

test("ensureCanonicalDatabase keeps canonical when it already has more rows", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "petpal-db-"));
  const legacy = path.join(root, "data", "petpal.sqlite");
  const canonical = path.join(root, "live", "petpal.sqlite");
  seedDb(legacy, 3);
  seedDb(canonical, 8);

  const result = ensureCanonicalDatabase(root, canonical);
  assert.equal(result.restoredFrom, null);
  assert.equal(countPositionsInFile(canonical), 8);
});
