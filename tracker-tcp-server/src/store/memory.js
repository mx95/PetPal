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

function resolveCharging(parsed, deviceStatus) {
  const ds = deviceStatus || {};
  if (parsed?.chargingEvent === "connected") return true;
  if (parsed?.chargingEvent === "complete" || parsed?.chargingEvent === "disconnected") return false;
  const fromStatus = toBool01(ds.chargingStatus);
  if (fromStatus != null) return fromStatus;
  return toBool01(parsed?.statusDetail?.charging);
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

function incomingHasNewLocationFix(p) {
  if (!p || typeof p !== "object") return false;
  const gps = p.gps || {};
  const loc = p.location || null;
  const lat = gps.lat != null ? Number(gps.lat) : loc?.lat != null ? Number(loc.lat) : Number.NaN;
  const lng = gps.lng != null ? Number(gps.lng) : loc?.lng != null ? Number(loc.lng) : Number.NaN;
  return isPlausibleLatLng(lat, lng);
}

function normalizeIncomingDevice(prev, incoming, canonicalImei = null) {
  // Back-compat: allow pre-shaped records (seed fixtures).
  if (incoming && incoming.location && typeof incoming === "object") {
    return mergeDeviceRecord(prev, {
      ...incoming,
      imei: canonicalImei || incoming.imei || prev?.imei || null,
      _recordPosition: incomingHasNewLocationFix(incoming),
    });
  }

  const p = incoming && typeof incoming === "object" ? incoming : {};
  const imei = String(canonicalImei || p.imei || prev?.imei || "").trim();
  if (!imei) return mergeDeviceRecord(prev, incoming);

  const ds = p.deviceStatus || {};
  const gps = p.gps || {};
  const lat = gps.lat != null ? Number(gps.lat) : Number.NaN;
  const lng = gps.lng != null ? Number(gps.lng) : Number.NaN;
  const atHomeWifi = p.gps?.atHomeWifi === true;

  const next = {
    imei,
    provider: p.provider ?? prev?.provider ?? null,
    atHomeWifi,
    wifiBssids: p.wifiBssids ?? p.gps?.wifiBssids ?? null,
    location: isPlausibleLatLng(lat, lng) ? { lat, lng } : null,
    homeLocation:
      p.source === "gps" && p.gpsValid !== false && isPlausibleLatLng(lat, lng)
        ? { lat, lng }
        : prev?.homeLocation ?? null,
    gpsValid: p.gpsValid === true,
    source: p.source || gps.source || null, // "gps" | "lbs"
    accuracy: p.accuracy || null, // "gps" | "wifi" | "lbs" (wifi not implemented yet)
    satellites: p.satellites ?? gps.satellites ?? null,

    battery: ds.battery ?? p.statusDetail?.battery ?? null,
    signal: ds.signal ?? p.signal ?? p.statusDetail?.signal ?? null,
    steps: ds.steps ?? p.statusDetail?.steps ?? null,
    moving: toBool01(ds.movement),
    charging: resolveCharging(p, ds),

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
  next._recordPosition = incomingHasNewLocationFix(p);

  return mergeDeviceRecord(prev, next);
}

/**
 * Each uplink replaces the in-memory record. Status-only packets often omit GPS blocks,
 * which would clear coordinates for GET /position unless we keep the last fix.
 */
function mergeDeviceRecord(prev, incoming) {
  if (!prev) return incoming;
  const merged = { ...incoming };
  if (!incoming.source && prev?.source) merged.source = prev.source;
  if (!incoming.atHomeWifi && prev?.atHomeWifi) merged.atHomeWifi = prev.atHomeWifi;
  if ((!incoming.wifiBssids || incoming.wifiBssids.length === 0) && prev?.wifiBssids?.length) {
    merged.wifiBssids = prev.wifiBssids;
  }
  if (!incoming.homeLocation && prev?.homeLocation) merged.homeLocation = prev.homeLocation;
  if (incoming.homeLocation && hasValidGps(incoming.homeLocation)) {
    merged.homeLocation = incoming.homeLocation;
  }
  if (incoming.source === "gps" && incoming.gpsValid !== false && hasValidGps(incoming.location)) {
    merged.homeLocation = { lat: incoming.location.lat, lng: incoming.location.lng };
  }
  const incomingWifi =
    incoming.atHomeWifi ||
    incoming.source === "wifi" ||
    (Array.isArray(incoming.wifiBssids) && incoming.wifiBssids.length > 0);
  const prevWifi =
    prev?.atHomeWifi ||
    prev?.source === "wifi" ||
    (Array.isArray(prev?.wifiBssids) && prev.wifiBssids.length > 0);
  if (
    !incomingWifi &&
    prevWifi &&
    incoming.source === "lbs" &&
    !hasValidGps(incoming.location)
  ) {
    merged.source = "wifi";
    merged.atHomeWifi = true;
    merged.location = null;
    merged.gps = {
      lat: null,
      lng: null,
      speedKmh: incoming.speed ?? prev.speed ?? null,
      timestamp: incoming.lastUpdate ?? prev.lastUpdate ?? null,
    };
  }
  if (incoming.atHomeWifi && !hasValidGps(incoming.location)) {
    merged.location = null;
    merged.gps = {
      lat: null,
      lng: null,
      speedKmh: incoming.speed ?? null,
      timestamp: incoming.lastUpdate ?? null,
    };
  } else if (!merged.atHomeWifi && !hasValidGps(incoming.gps) && hasValidGps(prev.gps)) {
    merged.gps = prev.gps;
    if (!incoming.gpsRaw && prev.gpsRaw) merged.gpsRaw = prev.gpsRaw;
  }
  if (
    !merged.atHomeWifi &&
    (!incoming.location || !hasValidGps(incoming.location)) &&
    prev.location &&
    hasValidGps(prev.location)
  ) {
    merged.location = prev.location;
  }
  if (merged.location && (!merged.gps || !hasValidGps(merged.gps))) {
    merged.gps = { lat: merged.location.lat, lng: merged.location.lng, speedKmh: merged.speed ?? null, timestamp: merged.lastUpdate ?? null };
  }
  if (incoming.battery == null && prev?.battery != null) merged.battery = prev.battery;
  if (incoming.signal == null && prev?.signal != null) merged.signal = prev.signal;
  if (incoming.charging == null && prev?.charging != null) merged.charging = prev.charging;
  if (incoming.steps == null && prev?.steps != null) merged.steps = prev.steps;
  return merged;
}

function createMemoryStore() {
  const devices = new Map(); // imei -> latest object
  const commandQueues = new Map(); // imei -> string[]
  const seqByImei = new Map();
  const socketsByImei = new Map();

  return {
    upsert(imei, data) {
      if (!imei) return false;
      const key = String(imei);
      const prev = devices.get(key);
      const normalized = normalizeIncomingDevice(prev, data, key);
      const recordPosition = Boolean(normalized._recordPosition);
      delete normalized._recordPosition;
      normalized.imei = key;
      devices.set(key, normalized);
      return recordPosition;
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
    },
    setHomeLocation(imei, lat, lng) {
      if (!imei || !isPlausibleLatLng(lat, lng)) return false;
      const k = String(imei);
      const prev = devices.get(k) || { imei: k };
      devices.set(k, {
        ...prev,
        imei: k,
        homeLocation: { lat: Number(lat), lng: Number(lng) },
      });
      return true;
    },
  };
}

module.exports = { createMemoryStore };

