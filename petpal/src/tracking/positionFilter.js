/** Max plausible speed between fixes (km/h) — filters GPS outliers / bad triangulation jumps. */
const MAX_PLAUSIBLE_SPEED_KMH = 50;
/** Hard cap on a single segment length (km). */
const MAX_SINGLE_JUMP_KM = 3;
/** Collars often upload several fixes with the same receive time — cap segment length for those batches. */
const MAX_BATCH_JUMP_KM = 0.2;
/** Collar speed above this (km/h) is treated as a bad reading for display and analytics. */
const MAX_PLAUSIBLE_PET_SPEED_KMH = 40;

export function sanitizeSpeedKmh(speed) {
  const n = Number(speed);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > MAX_PLAUSIBLE_PET_SPEED_KMH) return null;
  return n;
}

function toRad(v) {
  return (v * Math.PI) / 180;
}

export function kmBetween(a, b) {
  if (!a || !b) return 0;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return 0;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** When the server received this fix (preferred for history ordering and date filters). */
export function pointReceivedIso(p) {
  return p?.receivedAt || p?.serverTime || p?.lastUpdateServer || p?.timestamp || null;
}

export function pointTimestampMs(p) {
  const iso = pointReceivedIso(p) || p?.deviceTimeUtc || p?.deviceTime;
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * True when coordinates should be treated as a real GPS fix (not LBS / Wi‑Fi / triangulation).
 */
export function isTrustedGpsFix(p) {
  if (!p) return false;
  if (p.gpsValid === false) return false;
  if (p.warningApproximate) return false;
  if (p.positionHeldFromPreviousGps) return false;

  const src = String(p.source || '').toLowerCase();
  if (src === 'lbs' || src === 'wifi' || src === 'cell' || src.includes('triangul') || src.includes('tower') || src.includes('gsm')) {
    return false;
  }

  const acc = String(p.accuracy || '').toLowerCase();
  if (acc === 'lbs' || acc === 'wifi' || acc === 'low') return false;

  return true;
}

export function isPlausibleGpsJump(prev, next) {
  if (!prev || prev.lat == null || prev.lng == null) return true;
  if (!next || next.lat == null || next.lng == null) return false;

  const distKm = kmBetween(prev, next);
  if (distKm > MAX_SINGLE_JUMP_KM) return false;

  const t0 = pointTimestampMs(prev);
  const t1 = pointTimestampMs(next);
  if (t0 == null || t1 == null) return distKm <= MAX_SINGLE_JUMP_KM;

  const dtSec = (t1 - t0) / 1000;
  // Batched fixes share receive time — allow only short hops, not multi‑km GPS spikes.
  if (dtSec <= 0) return distKm <= MAX_BATCH_JUMP_KM;

  const speedKmh = (distKm / dtSec) * 3600;
  return speedKmh <= MAX_PLAUSIBLE_SPEED_KMH;
}

/** Count distinct coordinate pairs (5 decimal places ≈ 1 m). */
export function countDistinctLocations(points) {
  if (!Array.isArray(points) || points.length === 0) return 0;
  const seen = new Set();
  for (const p of points) {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    seen.add(`${lat.toFixed(5)},${lng.toFixed(5)}`);
  }
  return seen.size;
}

/**
 * History analytics: drop LBS / approximate fixes and implausible jumps (no held coords).
 * Prefer {@link resolveTrackerPositions} for map polylines to avoid spike lines.
 */
export function resolveHistoryPositions(points) {
  if (!Array.isArray(points) || points.length === 0) return [];

  let prevTrusted = null;
  const out = [];

  for (const p of points) {
    if (!p || Number.isNaN(Number(p.lat)) || Number.isNaN(Number(p.lng))) continue;
    const candidate = {
      ...p,
      lat: Number(p.lat),
      lng: Number(p.lng),
      speed: sanitizeSpeedKmh(p.speed),
    };
    if (!isTrustedGpsFix(candidate)) continue;

    if (!prevTrusted) {
      out.push(candidate);
      prevTrusted = candidate;
      continue;
    }

    if (!isPlausibleGpsJump(prevTrusted, candidate)) continue;

    out.push(candidate);
    prevTrusted = candidate;
  }

  return out;
}

function isTrustedFixWithJumpCheck(anchor, point) {
  return isTrustedGpsFix(point) && isPlausibleGpsJump(anchor, point);
}

/**
 * History / route display: omit LBS / triangulation; hold last GPS on outliers (no map spikes).
 * Speed checks use the previous raw trusted fix (not the first fix), so a walk after home
 * is not collapsed to the starting anchor.
 */
export function resolveTrackerPositions(points) {
  if (!Array.isArray(points) || points.length === 0) return [];

  let lastOut = null;
  let prevTrusted = null;
  const out = [];

  for (const p of points) {
    if (!p || Number.isNaN(Number(p.lat)) || Number.isNaN(Number(p.lng))) continue;
    const candidate = { ...p, lat: Number(p.lat), lng: Number(p.lng) };

    if (!isTrustedGpsFix(candidate)) continue;

    if (!lastOut) {
      out.push(candidate);
      lastOut = candidate;
      prevTrusted = candidate;
      continue;
    }

    if (isPlausibleGpsJump(prevTrusted, candidate)) {
      out.push(candidate);
      lastOut = candidate;
      prevTrusted = candidate;
      continue;
    }

    out.push({
      ...candidate,
      lat: lastOut.lat,
      lng: lastOut.lng,
      positionHeldFromPreviousGps: true,
    });
    // Chain plausibility on raw fixes so a later walk is not blocked by an old home anchor.
    prevTrusted = candidate;
  }

  return out;
}

/**
 * Live map: show last trusted GPS only — approximate / outlier fixes are stored but not plotted.
 */
export function applyHeldGpsPosition(position, anchor) {
  if (!position || position.lat == null || position.lng == null) return position;

  const pt = {
    ...position,
    lat: Number(position.lat),
    lng: Number(position.lng),
  };

  if (isTrustedFixWithJumpCheck(anchor, pt)) {
    return { ...pt, positionHeldFromPreviousGps: false };
  }

  if (anchor && Number.isFinite(Number(anchor.lat)) && Number.isFinite(Number(anchor.lng))) {
    return {
      ...pt,
      lat: Number(anchor.lat),
      lng: Number(anchor.lng),
      positionHeldFromPreviousGps: true,
    };
  }

  return { ...pt, lat: null, lng: null, positionHiddenApproximate: true };
}

/** Update rolling anchor after a displayed fix that was not held from a prior point. */
export function anchorFromDisplayedPosition(p) {
  if (!p || p.positionHeldFromPreviousGps) return null;
  if (!isTrustedGpsFix(p)) return null;
  if (p.lat == null || p.lng == null) return null;
  return {
    lat: Number(p.lat),
    lng: Number(p.lng),
    timestamp: p.timestamp,
    deviceTime: p.deviceTime,
    deviceTimeUtc: p.deviceTimeUtc,
    serverTime: p.serverTime,
    lastUpdate: p.lastUpdate,
  };
}
