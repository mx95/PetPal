const { createMemoryStore } = require("./memory");
const { openSqlite } = require("../db/sqlite");
const { isPlausibleLatLng } = require("../geo/coords");
const { effectiveProvider } = require("../deviceProvider");

function hasFiniteLatLng(obj) {
  if (!obj) return false;
  return isPlausibleLatLng(obj.lat, obj.lng);
}

function toDeviceRow(rec) {
  const imei = String(rec?.imei || "").trim();
  if (!imei) return null;

  const loc = rec.location || rec.gps || null;
  const last_lat = hasFiniteLatLng(loc) ? Number(loc.lat) : null;
  const last_lng = hasFiniteLatLng(loc) ? Number(loc.lng) : null;
  const isGpsHome =
    rec.source === "gps" && rec.gpsValid !== false && hasFiniteLatLng(loc);
  let home_lat = null;
  let home_lng = null;
  if (rec.homeLocation && hasFiniteLatLng(rec.homeLocation)) {
    home_lat = Number(rec.homeLocation.lat);
    home_lng = Number(rec.homeLocation.lng);
  } else if (isGpsHome) {
    home_lat = Number(loc.lat);
    home_lng = Number(loc.lng);
  }

  return {
    imei,
    name: rec.name ?? null,
    last_lat,
    last_lng,
    home_lat,
    home_lng,
    battery: rec.battery ?? null,
    signal: rec.signal ?? null,
    source: rec.source ?? null,
    provider: rec.provider ?? null,
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
  const source = r.source ?? null;
  const isApprox = source === "lbs" || source === "wifi";
  return {
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    source,
    battery: r.battery ?? null,
    signal: r.signal ?? null,
    timestamp: receivedAt,
    receivedAt,
    deviceTimeUtc: r.device_timestamp ?? null,
    gpsValid: isApprox ? false : true,
    warningApproximate: isApprox,
    accuracy: source === "wifi" ? "wifi" : source === "lbs" ? "lbs" : "high",
  };
}

function deviceConfigFromRow(row) {
  if (!row) return null;
  return {
    providerOverride: row.provider_override ?? null,
    gpsposPlatformImei: row.gpspos_platform_imei ?? null,
    gpsposPollIntervalSec:
      row.gpspos_poll_interval_sec != null ? Number(row.gpspos_poll_interval_sec) : null,
    gpsposPollEnabled: Boolean(Number(row.gpspos_poll_enabled)),
  };
}

function enrichDevice(device, row) {
  if (!device) return null;
  const config = deviceConfigFromRow(row);
  const provider = effectiveProvider(device, row?.provider_override);
  return {
    ...device,
    provider,
    deviceConfig: config,
  };
}

function deviceFromRow(row) {
  if (!row) return null;
  const lat = row.last_lat != null ? Number(row.last_lat) : null;
  const lng = row.last_lng != null ? Number(row.last_lng) : null;
  const source = row.source ?? null;
  const wifiSource = source === "wifi";
  const hasLoc = !wifiSource && lat != null && lng != null && isPlausibleLatLng(lat, lng);
  const homeLat = row.home_lat != null ? Number(row.home_lat) : null;
  const homeLng = row.home_lng != null ? Number(row.home_lng) : null;
  const homeLocation =
    homeLat != null && homeLng != null && isPlausibleLatLng(homeLat, homeLng)
      ? { lat: homeLat, lng: homeLng }
      : null;
  return {
    imei: row.imei,
    name: row.name ?? null,
    battery: row.battery ?? null,
    signal: row.signal ?? null,
    source,
    provider: row.provider ?? null,
    atHomeWifi: wifiSource,
    homeLocation,
    lastUpdate: row.last_update ?? null,
    location: hasLoc ? { lat, lng } : null,
    gps: hasLoc
      ? { lat, lng, speedKmh: null, timestamp: row.last_update ?? null }
      : { lat: null, lng: null, speedKmh: null, timestamp: row.last_update ?? null },
  };
}

/**
 * Store contract used by HTTP routes and TCP handler:
 * - keep command queues / sockets in memory
 * - persist device snapshots + positions into SQLite
 */
function attachHomeIfMissing(device, imei, sqlite) {
  if (!device || device.homeLocation) return;
  const row = sqlite.getDevice.get(String(imei));
  if (row?.home_lat != null && row?.home_lng != null && isPlausibleLatLng(row.home_lat, row.home_lng)) {
    device.homeLocation = { lat: Number(row.home_lat), lng: Number(row.home_lng) };
    return;
  }
  const gps = sqlite.getLastGpsPosition.get(String(imei));
  if (gps && isPlausibleLatLng(gps.lat, gps.lng)) {
    device.homeLocation = { lat: Number(gps.lat), lng: Number(gps.lng) };
  }
}

function createSqliteStore({ dbPath }) {
  const mem = createMemoryStore();
  const sqlite = openSqlite(dbPath);

  function persistFromMemory(imei, { recordPosition = false } = {}) {
    const rec = mem.get(imei);
    if (!rec) return;

    const dRow = toDeviceRow({ ...rec, imei: String(imei) });
    if (dRow) sqlite.upsertDevice.run(dRow);

    if (!recordPosition) return;
    const pRow = toPositionRow({ ...rec, imei: String(imei) });
    if (pRow) sqlite.insertPosition.run(pRow);
  }

  const countPositionsStmt = sqlite.db.prepare(`SELECT COUNT(*) AS n FROM positions`);

  return {
    sqlitePath: sqlite.path,

    countPositions() {
      const row = countPositionsStmt.get();
      return row?.n != null ? Number(row.n) : 0;
    },

    upsert(imei, data) {
      const recordPosition = mem.upsert(imei, data);
      persistFromMemory(imei, { recordPosition });
    },

    list() {
      const rows = sqlite.listDevices.all();
      const liveByImei = new Map(mem.list().map((d) => [String(d.imei), d]));
      const seen = new Set();
      const out = rows.map((row) => {
        const imei = String(row.imei);
        seen.add(imei);
        const live = liveByImei.get(imei);
        const base = live || deviceFromRow(row);
        return enrichDevice(base, row);
      });
      for (const d of mem.list()) {
        const imei = String(d.imei);
        if (!seen.has(imei)) {
          const row = sqlite.getDevice.get(imei);
          out.push(enrichDevice(d, row));
        }
      }
      return out;
    },

    get(imei) {
      const live = mem.get(imei);
      const row = sqlite.getDevice.get(String(imei));
      if (live) {
        attachHomeIfMissing(live, imei, sqlite);
        return enrichDevice(live, row);
      }
      const fromRow = deviceFromRow(row);
      if (fromRow) {
        attachHomeIfMissing(fromRow, imei, sqlite);
        return enrichDevice(fromRow, row);
      }
      return null;
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

    countHistoryInRange(imei, { from = null, to = null } = {}) {
      const fromS = from != null && String(from).trim() !== "" ? String(from).trim() : null;
      const toS = to != null && String(to).trim() !== "" ? String(to).trim() : null;
      if (!fromS || !toS || typeof sqlite.countHistoryByImeiInRange?.get !== "function") return null;
      const row = sqlite.countHistoryByImeiInRange.get({
        imei: String(imei),
        from: fromS,
        to: toS,
      });
      const n = Number(row?.count);
      return Number.isFinite(n) ? n : null;
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
    },

    setHomeLocation(imei, lat, lng) {
      if (!isPlausibleLatLng(lat, lng)) return false;
      const k = String(imei);
      if (!mem.setHomeLocation(k, lat, lng)) return false;
      const row = sqlite.getDevice.get(k);
      sqlite.upsertDevice.run({
        imei: k,
        name: row?.name ?? null,
        last_lat: row?.last_lat ?? null,
        last_lng: row?.last_lng ?? null,
        home_lat: Number(lat),
        home_lng: Number(lng),
        battery: row?.battery ?? null,
        signal: row?.signal ?? null,
        source: row?.source ?? null,
        provider: row?.provider ?? null,
        last_update: row?.last_update ?? new Date().toISOString(),
      });
      return true;
    },

    getDeviceConfig(imei) {
      return sqlite.getDevice.get(String(imei)) || null;
    },

    listDeviceConfigs() {
      return sqlite.listDevices.all();
    },

    listGpsposPollTargets() {
      return sqlite.listGpsposPollTargets.all();
    },

    updateDeviceConfig(imei, patch) {
      const k = String(imei);
      sqlite.ensureDevice.run(k);
      const current = sqlite.getDevice.get(k) || {};
      sqlite.updateDeviceConfig.run({
        imei: k,
        provider_override:
          patch.provider_override !== undefined ? patch.provider_override : current.provider_override ?? null,
        gpspos_platform_imei:
          patch.gpspos_platform_imei !== undefined
            ? patch.gpspos_platform_imei
            : current.gpspos_platform_imei ?? null,
        gpspos_poll_interval_sec:
          patch.gpspos_poll_interval_sec !== undefined
            ? patch.gpspos_poll_interval_sec
            : current.gpspos_poll_interval_sec ?? null,
        gpspos_poll_enabled:
          patch.gpspos_poll_enabled !== undefined
            ? patch.gpspos_poll_enabled
            : current.gpspos_poll_enabled ?? 0,
      });
    },

    close() {
      sqlite.db.close();
    },
  };
}

module.exports = { createSqliteStore };

