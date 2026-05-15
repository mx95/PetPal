const { createMemoryStore } = require("./memory");
const { openSqlite } = require("../db/sqlite");

function hasFiniteLatLng(obj) {
  if (!obj) return false;
  const lat = obj.lat != null ? Number(obj.lat) : Number.NaN;
  const lng = obj.lng != null ? Number(obj.lng) : Number.NaN;
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function toDeviceRow(rec) {
  const imei = String(rec?.imei || "").trim();
  if (!imei) return null;

  const loc = rec.location || rec.gps || null;
  const last_lat = hasFiniteLatLng(loc) ? Number(loc.lat) : null;
  const last_lng = hasFiniteLatLng(loc) ? Number(loc.lng) : null;

  return {
    imei,
    name: rec.name ?? null,
    last_lat,
    last_lng,
    battery: rec.battery ?? null,
    signal: rec.signal ?? null,
    source: rec.source ?? null,
    last_update: rec.lastUpdate ?? rec.receivedAt ?? null
  };
}

function toPositionRow(rec) {
  const imei = String(rec?.imei || "").trim();
  if (!imei) return null;

  const loc = rec.location || rec.gps || null;
  if (!hasFiniteLatLng(loc)) return null;

  const receivedAt = String(rec.lastUpdate || rec.receivedAt || new Date().toISOString());
  const deviceIso = rec.gps?.timestamp || rec.deviceStatus?.timestamp || null;
  const deviceMs = deviceIso ? Date.parse(deviceIso) : Number.NaN;
  const device_timestamp =
    deviceIso && Number.isFinite(deviceMs) ? String(deviceIso) : null;

  return {
    imei,
    lat: Number(loc.lat),
    lng: Number(loc.lng),
    source: rec.source ?? null,
    battery: rec.battery ?? null,
    signal: rec.signal ?? null,
    timestamp: receivedAt,
    received_at: receivedAt,
    device_timestamp,
  };
}

function mapHistoryRow(r) {
  const receivedAt = r.received_at ?? r.timestamp ?? null;
  return {
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    source: r.source ?? null,
    battery: r.battery ?? null,
    signal: r.signal ?? null,
    timestamp: receivedAt,
    receivedAt,
    deviceTimeUtc: r.device_timestamp ?? null,
  };
}

function deviceFromRow(row) {
  if (!row) return null;
  const lat = row.last_lat != null ? Number(row.last_lat) : null;
  const lng = row.last_lng != null ? Number(row.last_lng) : null;
  return {
    imei: row.imei,
    name: row.name ?? null,
    battery: row.battery ?? null,
    signal: row.signal ?? null,
    source: row.source ?? null,
    lastUpdate: row.last_update ?? null,
    location:
      lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    gps:
      lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng, speedKmh: null, timestamp: row.last_update ?? null }
        : { lat: null, lng: null, speedKmh: null, timestamp: row.last_update ?? null }
  };
}

/**
 * Store contract used by HTTP routes and TCP handler:
 * - keep command queues / sockets in memory
 * - persist device snapshots + positions into SQLite
 */
function createSqliteStore({ dbPath }) {
  const mem = createMemoryStore();
  const sqlite = openSqlite(dbPath);

  function persistFromMemory(imei) {
    const rec = mem.get(imei);
    if (!rec) return;

    const dRow = toDeviceRow(rec);
    if (dRow) sqlite.upsertDevice.run(dRow);

    const pRow = toPositionRow(rec);
    if (pRow) sqlite.insertPosition.run(pRow);
  }

  return {
    sqlitePath: sqlite.path,

    upsert(imei, data) {
      mem.upsert(imei, data);
      persistFromMemory(imei);
    },

    list() {
      const rows = sqlite.listDevices.all();
      return rows.map(deviceFromRow);
    },

    get(imei) {
      const live = mem.get(imei);
      if (live) return live;
      const row = sqlite.getDevice.get(String(imei));
      return deviceFromRow(row);
    },

    history(imei, { limit = 100, from = null, to = null } = {}) {
      const fromS = from != null && String(from).trim() !== "" ? String(from).trim() : null;
      const toS = to != null && String(to).trim() !== "" ? String(to).trim() : null;

      if (fromS && toS) {
        const n = Number(limit);
        const safeLimit = Number.isFinite(n) && n > 0 ? Math.min(20000, Math.floor(n)) : 20000;
        const rows = sqlite.listHistoryByImeiInRange.all({
          imei: String(imei),
          from: fromS,
          to: toS,
          limit: safeLimit,
        });
        return rows.map(mapHistoryRow);
      }

      const n = Number(limit);
      const safeLimit = Number.isFinite(n) && n > 0 ? Math.min(10000, Math.floor(n)) : 100;
      const rows = sqlite.listHistoryByImeiById.all(String(imei), safeLimit);
      return rows.reverse().map(mapHistoryRow);
    },

    enqueueCommand: mem.enqueueCommand,
    dequeueCommand: mem.dequeueCommand,
    pendingCommands: mem.pendingCommands,
    nextSequence: mem.nextSequence,
    bindSocket: mem.bindSocket,
    releaseSocket: mem.releaseSocket,
    getSocket: mem.getSocket,

    recordCommandQueued({ imei, command, requestedAt, requestedBy }) {
      const ts = requestedAt || new Date().toISOString();
      const info = sqlite.insertCommandQueued.run({
        imei: String(imei),
        command: String(command),
        requested_at: ts,
        requested_by: requestedBy ?? null
      });
      return { id: info.lastInsertRowid, requestedAt: ts };
    },

    markCommandSent({ imei, command, sentAt }) {
      sqlite.markLatestCommandSent.run({
        imei: String(imei),
        command: String(command),
        sent_at: sentAt || new Date().toISOString()
      });
    },

    markLatestCommandAcked({ imei, ackedAt }) {
      sqlite.markLatestCommandAcked.run({
        imei: String(imei),
        acked_at: ackedAt || new Date().toISOString()
      });
    },

    recordHttpRequest({
      ts,
      method,
      path,
      queryJson,
      bodyJson,
      ip,
      userAgent,
      statusCode,
      latencyMs
    }) {
      sqlite.insertHttpRequest.run({
        ts: ts || new Date().toISOString(),
        method: String(method || ""),
        path: String(path || ""),
        query_json: queryJson ?? null,
        body_json: bodyJson ?? null,
        ip: ip ?? null,
        user_agent: userAgent ?? null,
        status_code: statusCode ?? null,
        latency_ms: latencyMs ?? null
      });
    },

    recordTcpInboundRequest({
      ts,
      remoteAddress,
      remotePort,
      event,
      imei,
      messageId,
      byteLength,
      rawHex,
      asciiPreview,
      parsedJson,
      note
    }) {
      sqlite.insertTcpInboundRequest.run({
        ts: ts || new Date().toISOString(),
        remote_address: remoteAddress ?? null,
        remote_port: remotePort ?? null,
        event: String(event || "data"),
        imei: imei ?? null,
        message_id: messageId ?? null,
        byte_length: byteLength ?? null,
        raw_hex: rawHex ?? null,
        ascii_preview: asciiPreview ?? null,
        parsed_json: parsedJson ?? null,
        note: note ?? null
      });
    }
  };
}

module.exports = { createSqliteStore };

