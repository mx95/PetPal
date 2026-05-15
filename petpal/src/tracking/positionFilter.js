/** Max plausible speed between fixes (km/h) — filters GPS outliers / bad triangulation jumps. */
const MAX_PLAUSIBLE_SPEED_KMH = 50;
/** Hard cap on a single segment length (km). */
const MAX_SINGLE_JUMP_KM = 3;

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

export function pointTimestampMs(p) {
  const iso = p?.timestamp || p?.deviceTimeUtc || p?.deviceTime || p?.serverTime || p?.lastUpdate;
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
  if (t0 == null || t1 == null) return distKm < 0.5;

  const dtSec = (t1 - t0) / 1000;
  if (dtSec <= 0) return distKm < 0.05;

  const speedKmh = (distKm / dtSec) * 3600;
  return speedKmh <= MAX_PLAUSIBLE_SPEED_KMH;
}

function isTrustedFixWithJumpCheck(anchor, point) {
  return isTrustedGpsFix(point) && isPlausibleGpsJump(anchor, point);
}

/**
 * History / route display: omit LBS / triangulation; hold last GPS on outliers (no map spikes).
 */
export function resolveTrackerPositions(points) {
  if (!Array.isArray(points) || points.length === 0) return [];

  let anchor = null;
  const out = [];

  for (const p of points) {
    if (!p || Number.isNaN(Number(p.lat)) || Number.isNaN(Number(p.lng))) continue;
    const candidate = { ...p, lat: Number(p.lat), lng: Number(p.lng) };

    if (!isTrustedGpsFix(candidate)) continue;

    if (!anchor) {
      anchor = {
        lat: candidate.lat,
        lng: candidate.lng,
        timestamp: candidate.timestamp,
        deviceTime: candidate.deviceTime,
        deviceTimeUtc: candidate.deviceTimeUtc,
        serverTime: candidate.serverTime,
      };
      out.push(candidate);
      continue;
    }

    if (isPlausibleGpsJump(anchor, candidate)) {
      anchor = {
        lat: candidate.lat,
        lng: candidate.lng,
        timestamp: candidate.timestamp,
        deviceTime: candidate.deviceTime,
        deviceTimeUtc: candidate.deviceTimeUtc,
        serverTime: candidate.serverTime,
      };
      out.push(candidate);
      continue;
    }

    out.push({
      ...candidate,
      lat: anchor.lat,
      lng: anchor.lng,
      positionHeldFromPreviousGps: true,
    });
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
