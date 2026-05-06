const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./tracker.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      imei TEXT PRIMARY KEY,
      name TEXT,
      last_lat REAL,
      last_lng REAL,
      battery INTEGER,
      signal INTEGER,
      source TEXT,
      last_update TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imei TEXT,
      lat REAL,
      lng REAL,
      source TEXT,
      battery INTEGER,
      signal INTEGER,
      timestamp TEXT
    )
  `);
});

module.exports = db;

