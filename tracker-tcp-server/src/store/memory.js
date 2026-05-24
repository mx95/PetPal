const { isPlausibleLatLng } = require("../geo/coords");

function hasValidGps(gps) {
  if (!gps || gps.lat == null || gps.lng == null) return false;
  return isPlausibleLatLng(gps.lat, gps.lng);
}

function toBool01(v) {
  if (v === 1 || v === true) return true;
  if (v === 0 || v === false) return false;
  return null;
}

function makeJsonSafe(value) {
  if (Buffer.isBuffer(value)) return toHexString(value);
  if (Array.isArray(value)) return value.map(makeJsonSafe);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "function") continue;
    out[key] = makeJsonSafe(item);
  }
  return out;
}

function toHexString(buf) {
  return Buffer.isBuffer(buf) ? buf.toString("hex").toUpperCase() : null;
}

function normalizeIncomingDevice(prev, incoming) {
  // Back-compat: allow pre-shaped records (seed fixtures).
  if (incoming && incoming.location && typeof incoming === "object") {
    return mergeDeviceRecord(prev, incoming);
  }

  const p = incoming && typeof incoming === "object" ? incoming : {};
  const imei = String(p.imei || prev?.imei || "").trim();
  if (!imei) return mergeDeviceRecord(prev, incoming);

  const ds = p.deviceStatus || {};
  const gps = p.gps || {};
  const lat = gps.lat != null ? Number(gps.lat) : Number.NaN;
  const lng = gps.lng != null ? Number(gps.lng) : Number.NaN;
  const atHomeWifi = p.gps?.atHomeWifi === true;

  const next = {
    imei,
    atHomeWifi,
    wifiBssids: p.wifiBssids ?? p.gps?.wifiBssids ?? null,
    location: isPlausibleLatLng(lat, lng) ? { lat, lng } : null,
    gpsValid: p.gpsValid === true,
    source: p.source || gps.source || null, // "gps" | "lbs"
    accuracy: p.accuracy || null, // "gps" | "wifi" | "lbs" (wifi not implemented yet)
    satellites: p.satellites ?? gps.satellites ?? null,

    battery: ds.battery ?? null,
    signal: ds.signal ?? p.signal ?? null,
    steps: ds.steps ?? null,
    moving: toBool01(ds.movement),
    charging: toBool01(ds.chargingStatus),

    speed: gps.speedKmh != null ? Number(gps.speedKmh) : null,
    lastUpdate: p.receivedAt || new Date().toISOString(),

    raw: {
      messageId: p.messageId ?? null,
      sequence: p.sequence ?? null,
      rawHex: p.rawHex ?? null,
      crcOk: p.crcOk ?? null,
      gpsRaw: p.gpsRaw ?? null,
      lbsRaw: p.lbsRaw ?? null
    },
    received: {
      latest: makeJsonSafe(p),
      packets: [
        {
          receivedAt: p.receivedAt || new Date().toISOString(),
          data: makeJsonSafe(p)
        },
        ...((prev?.received?.packets || []).slice(0, 9))
      ]
    }
  };

  // Keep the old `gps` object around for legacy callers (if any) and merge logic.
  next.gps = next.location
    ? { lat: next.location.lat, lng: next.location.lng, speedKmh: next.speed, timestamp: ds.timestamp ?? gps.timestamp ?? null }
    : { lat: null, lng: null, speedKmh: next.speed, timestamp: ds.timestamp ?? gps.timestamp ?? null };

  return mergeDeviceRecord(prev, next);
}

/**
 * Each uplink replaces the in-memory record. Status-only packets often omit GPS blocks,
 * which would clear coordinates for GET /position unless we keep the last fix.
 */
function mergeDeviceRecord(prev, incoming) {
  if (!prev) return incoming;
  const merged = { ...incoming };
  if (incoming.atHomeWifi && !hasValidGps(incoming.location)) {
    merged.location = null;
    merged.gps = {
      lat: null,
      lng: null,
      speedKmh: incoming.speed ?? null,
      timestamp: incoming.lastUpdate ?? null,
    };
  } else if (!hasValidGps(incoming.gps) && hasValidGps(prev.gps)) {
    merged.gps = prev.gps;
    if (!incoming.gpsRaw && prev.gpsRaw) merged.gpsRaw = prev.gpsRaw;
  }
  if ((!incoming.location || !hasValidGps(incoming.location)) && prev.location && hasValidGps(prev.location)) {
    merged.location = prev.location;
  }
  if (merged.location && (!merged.gps || !hasValidGps(merged.gps))) {
    merged.gps = { lat: merged.location.lat, lng: merged.location.lng, speedKmh: merged.speed ?? null, timestamp: merged.lastUpdate ?? null };
  }
  return merged;
}

function createMemoryStore() {
  const devices = new Map(); // imei -> latest object
  const commandQueues = new Map(); // imei -> string[]
  const seqByImei = new Map();
  const socketsByImei = new Map();

  return {
    upsert(imei, data) {
      if (!imei) return;
      const key = String(imei);
      const prev = devices.get(key);
      const normalized = normalizeIncomingDevice(prev, data);
      devices.set(key, normalized);
    },
    list() {
      return Array.from(devices.values());
    },
    get(imei) {
      return devices.get(String(imei)) || null;
    },
    /** Queue a 0x21 command string (e.g. ip=host:port) for the next uplink. */
    enqueueCommand(imei, command, { atFront = false } = {}) {
      const k = String(imei);
      const q = commandQueues.get(k) || [];
      if (atFront) q.unshift(String(command).trim());
      else q.push(String(command).trim());
      commandQueues.set(k, q);
    },
    dequeueCommand(imei) {
      const k = String(imei);
      const q = commandQueues.get(k);
      if (!q || q.length === 0) return null;
      const cmd = q.shift();
      if (q.length === 0) commandQueues.delete(k);
      return cmd;
    },
    pendingCommands(imei) {
      return [...(commandQueues.get(String(imei)) || [])];
    },
    nextSequence(imei) {
      const k = String(imei);
      let n = (seqByImei.get(k) || 0) + 1;
      if (n > 255) n = 1;
      seqByImei.set(k, n);
      return n;
    },
    bindSocket(imei, socket) {
      if (!imei || !socket) return;
      socketsByImei.set(String(imei), socket);
    },
    releaseSocket(socket) {
      for (const [imei, s] of socketsByImei.entries()) {
        if (s === socket) socketsByImei.delete(imei);
      }
    },
    getSocket(imei) {
      return socketsByImei.get(String(imei)) || null;
    }
  };
}

module.exports = { createMemoryStore };

