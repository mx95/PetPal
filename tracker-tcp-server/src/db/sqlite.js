const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function openSqlite(dbPath) {
  const fullPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
  ensureDirForFile(fullPath);

  const db = new Database(fullPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      imei TEXT PRIMARY KEY,
      name TEXT,
      last_lat REAL,
      last_lng REAL,
      battery INTEGER,
      signal INTEGER,
      source TEXT,
      last_update TEXT
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imei TEXT,
      lat REAL,
      lng REAL,
      source TEXT,
      battery INTEGER,
      signal INTEGER,
      timestamp TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_positions_imei_ts ON positions(imei, timestamp);

    CREATE TABLE IF NOT EXISTS commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imei TEXT NOT NULL,
      command TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      requested_by TEXT,
      status TEXT NOT NULL,
      sent_at TEXT,
      acked_at TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_commands_imei_requested_at ON commands(imei, requested_at);
    CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);

    CREATE TABLE IF NOT EXISTS http_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      query_json TEXT,
      body_json TEXT,
      ip TEXT,
      user_agent TEXT,
      status_code INTEGER,
      latency_ms INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_http_requests_ts ON http_requests(ts);
  `);

  const upsertDevice = db.prepare(`
    INSERT INTO devices (imei, name, last_lat, last_lng, battery, signal, source, last_update)
    VALUES (@imei, @name, @last_lat, @last_lng, @battery, @signal, @source, @last_update)
    ON CONFLICT(imei) DO UPDATE SET
      name = COALESCE(excluded.name, devices.name),
      last_lat = COALESCE(excluded.last_lat, devices.last_lat),
      last_lng = COALESCE(excluded.last_lng, devices.last_lng),
      battery = COALESCE(excluded.battery, devices.battery),
      signal = COALESCE(excluded.signal, devices.signal),
      source = COALESCE(excluded.source, devices.source),
      last_update = COALESCE(excluded.last_update, devices.last_update)
  `);

  const insertPosition = db.prepare(`
    INSERT INTO positions (imei, lat, lng, source, battery, signal, timestamp)
    VALUES (@imei, @lat, @lng, @source, @battery, @signal, @timestamp)
  `);

  const listHistoryByImei = db.prepare(`
    SELECT lat, lng, source, battery, signal, timestamp
    FROM positions
    WHERE imei = ?
    ORDER BY timestamp DESC, id DESC
    LIMIT ?
  `);

  const listDevices = db.prepare(`
    SELECT imei, name, last_lat, last_lng, battery, signal, source, last_update
    FROM devices
    ORDER BY last_update DESC
  `);

  const getDevice = db.prepare(`
    SELECT imei, name, last_lat, last_lng, battery, signal, source, last_update
    FROM devices
    WHERE imei = ?
    LIMIT 1
  `);

  const insertCommandQueued = db.prepare(`
    INSERT INTO commands (imei, command, requested_at, requested_by, status)
    VALUES (@imei, @command, @requested_at, @requested_by, 'queued')
  `);

  const markLatestCommandSent = db.prepare(`
    UPDATE commands
    SET status = 'sent', sent_at = @sent_at
    WHERE id = (
      SELECT id FROM commands
      WHERE imei = @imei AND command = @command AND status = 'queued'
      ORDER BY requested_at DESC, id DESC
      LIMIT 1
    )
  `);

  const markLatestCommandAcked = db.prepare(`
    UPDATE commands
    SET status = 'acked', acked_at = @acked_at
    WHERE id = (
      SELECT id FROM commands
      WHERE imei = @imei AND status = 'sent'
      ORDER BY sent_at DESC, id DESC
      LIMIT 1
    )
  `);

  const insertHttpRequest = db.prepare(`
    INSERT INTO http_requests (ts, method, path, query_json, body_json, ip, user_agent, status_code, latency_ms)
    VALUES (@ts, @method, @path, @query_json, @body_json, @ip, @user_agent, @status_code, @latency_ms)
  `);

  return {
    path: fullPath,
    db,
    upsertDevice,
    insertPosition,
    listHistoryByImei,
    listDevices,
    getDevice,
    insertCommandQueued,
    markLatestCommandSent,
    markLatestCommandAcked,
    insertHttpRequest
  };
}

module.exports = { openSqlite };

