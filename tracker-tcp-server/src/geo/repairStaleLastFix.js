/**
 * After a collar moves from gpspos.net → direct TCP (GT06/365GPS/Xexun), a manual
 * /api/gpspos/sync can still overwrite the live fix with a stale LASTPOS.
 * Prefer a newer TCP history point when that happens.
 */

const { isPlausibleLatLng } = require("./coords");
const { TCP_PROVIDERS } = require("../directTcpPromote");

const MIN_SKEW_MS = 60 * 60 * 1000; // device GPS clock vs server receive
const MIN_DISTANCE_M = 500;
const RECENT_HISTORY_MS = 12 * 60 * 60 * 1000;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function currentCoords(device) {
  const lat = device?.location?.lat ?? device?.gps?.lat;
  const lng = device?.location?.lng ?? device?.gps?.lng;
  if (!isPlausibleLatLng(lat, lng)) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

function rowReceiveMs(row) {
  return Date.parse(row?.receivedAt || row?.timestamp || "");
}

function rowDeviceMs(row) {
  return Date.parse(row?.deviceTimeUtc || "");
}

/** Prefer fixes where collar GPS time roughly matches server receive time. */
function hasConsistentDeviceClock(row) {
  const recv = rowReceiveMs(row);
  if (!Number.isFinite(recv)) return false;
  const dev = rowDeviceMs(row);
  if (!Number.isFinite(dev)) return true;
  return Math.abs(recv - dev) <= MIN_SKEW_MS;
}

function pickFresherHistoryFix(device, history) {
  const provider = String(device?.provider || "").trim().toLowerCase();
  if (!TCP_PROVIDERS.has(provider)) return null;

  const cur = currentCoords(device);
  if (!cur) return null;

  const rows = Array.isArray(history) ? history : [];
  const now = Date.now();
  const deviceFixMs = Date.parse(device?.gps?.timestamp || device?.deviceStatus?.timestamp || "");

  // Newest → oldest: first recent GPS point with a consistent collar clock.
  let bestConsistent = null;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (!isPlausibleLatLng(row?.lat, row?.lng)) continue;
    if (row.source === "lbs" || row.source === "wifi") continue;
    const recvMs = rowReceiveMs(row);
    if (!Number.isFinite(recvMs) || now - recvMs > RECENT_HISTORY_MS) continue;
    if (!hasConsistentDeviceClock(row)) continue;
    bestConsistent = row;
    break;
  }

  if (bestConsistent) {
    const dist = haversineMeters(cur.lat, cur.lng, Number(bestConsistent.lat), Number(bestConsistent.lng));
    if (dist >= MIN_DISTANCE_M) {
      return {
        lat: Number(bestConsistent.lat),
        lng: Number(bestConsistent.lng),
        receivedAt: bestConsistent.receivedAt || bestConsistent.timestamp || null,
        deviceTimeUtc: bestConsistent.deviceTimeUtc || null,
        source: bestConsistent.source || "gps",
        distanceM: Math.round(dist),
      };
    }
  }

  // Fallback: any recent point far from current and newer than a stale device GPS clock.
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (!isPlausibleLatLng(row?.lat, row?.lng)) continue;
    if (row.source === "lbs" || row.source === "wifi") continue;
    const recvMs = rowReceiveMs(row);
    if (!Number.isFinite(recvMs) || now - recvMs > RECENT_HISTORY_MS) continue;
    const dist = haversineMeters(cur.lat, cur.lng, Number(row.lat), Number(row.lng));
    if (!(dist >= MIN_DISTANCE_M)) continue;
    const newerThanDeviceFix =
      !Number.isFinite(deviceFixMs) || recvMs > deviceFixMs + MIN_SKEW_MS;
    if (!newerThanDeviceFix) continue;
    return {
      lat: Number(row.lat),
      lng: Number(row.lng),
      receivedAt: row.receivedAt || row.timestamp || null,
      deviceTimeUtc: row.deviceTimeUtc || null,
      source: row.source || "gps",
      distanceM: Math.round(dist),
    };
  }
  return null;
}

/**
 * @param {{ history?: Function, upsert?: Function }} store
 * @param {object} device
 * @returns {{ device: object, repaired: boolean, from?: object }}
 */
function repairStaleLastFixFromHistory(store, device) {
  if (!device || typeof store?.history !== "function") {
    return { device, repaired: false };
  }
  const imei = String(device.imei || "").trim();
  if (!imei) return { device, repaired: false };

  let history;
  try {
    history = store.history(imei, { limit: 40 });
  } catch {
    return { device, repaired: false };
  }

  const better = pickFresherHistoryFix(device, history);
  if (!better) return { device, repaired: false };

  const patch = {
    imei,
    provider: device.provider,
    location: { lat: better.lat, lng: better.lng },
    gps: {
      lat: better.lat,
      lng: better.lng,
      speedKmh: device.gps?.speedKmh ?? device.speed ?? null,
      timestamp: better.deviceTimeUtc || better.receivedAt,
      heading: device.gps?.heading ?? device.heading ?? null,
    },
    gpsValid: true,
    source: better.source || "gps",
    receivedAt: better.receivedAt || new Date().toISOString(),
    lastUpdate: better.receivedAt || new Date().toISOString(),
    battery: device.battery ?? null,
    signal: device.signal ?? null,
    // Do not re-insert the history point we are restoring from.
    _recordPosition: false,
    // Drop stale gpspos LASTPOS payload so the app stops treating it as authoritative.
    raw: (() => {
      if (!device.raw || typeof device.raw !== "object") return device.raw ?? null;
      const { gpspos: _drop, ...rest } = device.raw;
      return Object.keys(rest).length ? rest : null;
    })(),
  };

  if (typeof store.upsert === "function") {
    store.upsert(imei, patch);
    const next = typeof store.get === "function" ? store.get(imei) : null;
    return { device: next || { ...device, ...patch }, repaired: true, from: better };
  }

  return {
    device: {
      ...device,
      location: patch.location,
      gps: patch.gps,
      source: patch.source,
      receivedAt: patch.receivedAt,
      lastUpdate: patch.lastUpdate,
    },
    repaired: true,
    from: better,
  };
}

module.exports = {
  haversineMeters,
  pickFresherHistoryFix,
  repairStaleLastFixFromHistory,
  hasConsistentDeviceClock,
  MIN_SKEW_MS,
  MIN_DISTANCE_M,
};
