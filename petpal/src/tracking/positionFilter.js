/** Collar firmware often sends 0,0 when GPS/LBS has no real fix ("Null Island"). */
export function hasPlausibleMapCoords(p) {
  if (!p || p.lat == null || p.lng == null) return false;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (Math.abs(lat) < 0.00001 && Math.abs(lng) < 0.00001) return false;
  // Partial failures: one axis stuck at 0 while the other looks valid (e.g. 0, 144.78).
  if (Math.abs(lat) < 0.001 || Math.abs(lng) < 0.001) return false;
  return true;
}

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

/**
 * Wi‑Fi / LBS may be shown on the live map only when coords look complete and
 * stay near the last trusted anchor (home region), not random ocean fixes.
 */
export function isReasonableApproxFix(point, anchor = null) {
  if (!hasPlausibleMapCoords(point)) return false;
  const lat = Math.abs(Number(point.lat));
  const lng = Math.abs(Number(point.lng));
  if (lat < 1 || lng < 1) return false;
  if (!anchor || !hasPlausibleMapCoords(anchor)) return true;
  return kmBetween(anchor, point) <= 25;
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

export function isPlausibleGpsJump(prev, next, limits = {}) {
  if (!prev || prev.lat == null || prev.lng == null) return true;
  if (!next || next.lat == null || next.lng == null) return false;

  const maxJumpKm = limits.maxJumpKm ?? MAX_SINGLE_JUMP_KM;
  const maxBatchJumpKm = limits.maxBatchJumpKm ?? MAX_BATCH_JUMP_KM;
  const maxSpeedKmh = limits.maxSpeedKmh ?? MAX_PLAUSIBLE_SPEED_KMH;

  const distKm = kmBetween(prev, next);
  if (distKm > maxJumpKm) return false;

  const t0 = pointTimestampMs(prev);
  const t1 = pointTimestampMs(next);
  if (t0 == null || t1 == null) return distKm <= maxJumpKm;

  const dtSec = (t1 - t0) / 1000;
  // Batched fixes share receive time — allow only short hops, not multi‑km GPS spikes.
  if (dtSec <= 0) return distKm <= maxBatchJumpKm;

  // Collar GPS often jitters 10–80 m between 1–15 s reports. Apparent speed
  // then looks like a sprint even when the pet is walking or still.
  if (dtSec < 20 && distKm <= 0.12) return true;

  const speedKmh = (distKm / dtSec) * 3600;
  return speedKmh <= maxSpeedKmh;
}

/**
 * History map polylines: keep a real walk (gaps of a few hundred metres,
 * noisy GT06 speeds) while still refusing multi‑km cell-tower ping-pong.
 */
const HISTORY_ROUTE_LIMITS = { maxJumpKm: 1.6, maxBatchJumpKm: 0.4, maxSpeedKmh: 80 };
const HISTORY_CLUSTER_RADIUS_KM = 0.12;
const HISTORY_CLUSTER_MIN_POINTS = 3;
/** Drop factory/default GPS (e.g. Shenzhen) far from the day's real cluster. */
const HISTORY_OUTLIER_KM = 80;
/**
 * gpspos.net LASTPOS (and similar) often keep an old collar GPS clock while
 * server receive time is “now”. Those points must not become the route anchor.
 */
const DEVICE_CLOCK_SKEW_DROP_MS = 6 * 60 * 60 * 1000;

export function hasSevereDeviceClockSkew(p, maxSkewMs = DEVICE_CLOCK_SKEW_DROP_MS) {
  if (!p) return false;
  const recv = pointTimestampMs(p);
  const devIso = p.deviceTimeUtc || p.deviceTime || null;
  if (recv == null || !devIso) return false;
  const dev = new Date(devIso).getTime();
  if (!Number.isFinite(dev)) return false;
  return Math.abs(recv - dev) > maxSkewMs;
}

/**
 * Keep GPS that sits near the day's densest cluster.
 * Prefer clock-consistent fixes for the anchor so a burst of stale LASTPOS
 * points at the end of the day cannot erase a real walk elsewhere.
 */
export function excludeFarGpsOutliers(points, maxKm = HISTORY_OUTLIER_KM) {
  const rows = (Array.isArray(points) ? points : []).filter(
    (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  );
  if (rows.length < 4) return rows;

  const withoutSkew = rows.filter((p) => !hasSevereDeviceClockSkew(p));
  const pool = withoutSkew.length >= 4 ? withoutSkew : rows;

  // ~1.1 km cells — densest cell is usually the real walk, not a lone LASTPOS island.
  const cellKey = (p) => `${Math.round(Number(p.lat) * 100)}_${Math.round(Number(p.lng) * 100)}`;
  const counts = new Map();
  for (const p of pool) {
    const k = cellKey(p);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let bestKey = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      bestKey = k;
      bestN = n;
    }
  }
  const cluster = bestKey ? pool.filter((p) => cellKey(p) === bestKey) : pool;
  const lats = cluster.map((p) => Number(p.lat)).sort((a, b) => a - b);
  const lngs = cluster.map((p) => Number(p.lng)).sort((a, b) => a - b);
  const mid = Math.floor(cluster.length / 2);
  const anchor = { lat: lats[mid], lng: lngs[mid] };

  const kept = rows.filter((p) => {
    if (hasSevereDeviceClockSkew(p)) return false;
    return kmBetween(p, anchor) <= maxKm;
  });
  if (kept.length >= 2) return kept;
  return withoutSkew.length >= 2 ? withoutSkew : rows;
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

function bearingDeg(a, b) {
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function angleDeltaDeg(a, b) {
  let d = Math.abs(b - a) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Sample route vertices for map dots — keeps turns and distance steps, skips redundant fixes.
 * @param {Array<{ lat: number, lng: number }>} points
 * @param {{ maxVertices?: number, minStepKm?: number, minTurnDeg?: number }} [opts]
 */
export function buildRouteVertexMarkers(points, opts = {}) {
  const maxVertices = opts.maxVertices ?? 240;
  const minStepKm = opts.minStepKm ?? 0.012;
  const minTurnDeg = opts.minTurnDeg ?? 18;

  if (!Array.isArray(points) || points.length === 0) return [];

  const coords = points
    .map((p, i) => ({
      i,
      lat: Number(p?.lat),
      lng: Number(p?.lng),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (coords.length === 0) return [];
  if (coords.length === 1) {
    return [
      {
        id: 'v-0',
        pointIndex: 0,
        lat: coords[0].lat,
        lng: coords[0].lng,
        kind: 'start',
        label: '',
      },
    ];
  }

  const picked = [coords[0]];

  for (let idx = 1; idx < coords.length - 1; idx++) {
    const cur = coords[idx];
    const last = picked[picked.length - 1];
    const dist = kmBetween(last, cur);
    let turn = false;
    if (picked.length >= 2) {
      const prev = picked[picked.length - 2];
      turn = angleDeltaDeg(bearingDeg(prev, last), bearingDeg(last, cur)) >= minTurnDeg;
    }
    if (dist >= minStepKm || turn) {
      picked.push(cur);
    }
    if (picked.length >= maxVertices - 1) break;
  }

  const tail = coords[coords.length - 1];
  if (picked[picked.length - 1].i !== tail.i) {
    picked.push(tail);
  }

  return picked.map((p, idx) => ({
    id: `v-${p.i}`,
    pointIndex: p.i,
    lat: p.lat,
    lng: p.lng,
    kind: idx === 0 ? 'start' : idx === picked.length - 1 ? 'end' : 'vertex',
    label: '',
  }));
}

/**
 * Bounds path for map fit — trims GPS outlier spikes so the view stays on the main trail.
 * @param {Array<{ lat: number, lng: number }>} path
 * @param {{ low?: number, high?: number }} [opts] percentile window (0–1)
 */
export function computeRouteFitPath(path, opts = {}) {
  const pts = (Array.isArray(path) ? path : [])
    .map((p) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length <= 2) return pts;

  const tailTrim = pts.length <= 8 ? 0.2 : pts.length <= 24 ? 0.1 : 0.06;
  const low = opts.low ?? tailTrim;
  const high = opts.high ?? 1 - tailTrim;

  const pick = (sorted, q) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
    return sorted[idx];
  };

  const lats = pts.map((p) => p.lat).sort((a, b) => a - b);
  const lngs = pts.map((p) => p.lng).sort((a, b) => a - b);
  const minLat = pick(lats, low);
  const maxLat = pick(lats, high);
  const minLng = pick(lngs, low);
  const maxLng = pick(lngs, high);

  if (minLat === maxLat && minLng === maxLng) return [{ lat: minLat, lng: minLng }];

  return [
    { lat: minLat, lng: minLng },
    { lat: minLat, lng: maxLng },
    { lat: maxLat, lng: minLng },
    { lat: maxLat, lng: maxLng },
  ];
}

function clusterIsCoherent(points, radiusKm = HISTORY_CLUSTER_RADIUS_KM) {
  if (!points.length) return false;
  const anchor = points[0];
  return points.every((p) => kmBetween(anchor, p) <= radiusKm);
}

/**
 * History map / timeline route: trusted GPS only, no lines to distant “ping‑pong” towers.
 * New clusters need several fixes in one place before connecting to the last plotted point.
 */
export function resolveHistoryRoutePositions(points) {
  if (!Array.isArray(points) || points.length === 0) return [];

  const trustedRaw = [];
  for (const p of points) {
    if (!p || Number.isNaN(Number(p.lat)) || Number.isNaN(Number(p.lng))) continue;
    if (hasSevereDeviceClockSkew(p)) continue;
    const candidate = { ...p, lat: Number(p.lat), lng: Number(p.lng), speed: sanitizeSpeedKmh(p.speed) };
    if (!isTrustedGpsFix(candidate)) continue;
    trustedRaw.push(candidate);
  }
  const trusted = excludeFarGpsOutliers(trustedRaw);
  if (trusted.length === 0) return [];

  const out = [];
  let lastPlotted = null;
  let prevRaw = null;
  let pendingCluster = [];

  const flushPendingCluster = () => {
    if (pendingCluster.length < HISTORY_CLUSTER_MIN_POINTS) {
      pendingCluster = [];
      return;
    }
    if (!clusterIsCoherent(pendingCluster)) {
      pendingCluster = [];
      return;
    }
    const seed = pendingCluster[0];
    const canConnect =
      !lastPlotted || isPlausibleGpsJump(lastPlotted, seed, HISTORY_ROUTE_LIMITS);
    if (!canConnect) {
      pendingCluster = [];
      return;
    }
    for (const p of pendingCluster) {
      out.push(p);
      lastPlotted = p;
    }
    pendingCluster = [];
  };

  for (const candidate of trusted) {
    if (!prevRaw) {
      out.push(candidate);
      lastPlotted = candidate;
      prevRaw = candidate;
      continue;
    }

    if (!isPlausibleGpsJump(prevRaw, candidate, HISTORY_ROUTE_LIMITS)) {
      flushPendingCluster();
      pendingCluster = [];
      continue;
    }
    prevRaw = candidate;

    if (!lastPlotted) {
      out.push(candidate);
      lastPlotted = candidate;
      continue;
    }

    if (isPlausibleGpsJump(lastPlotted, candidate, HISTORY_ROUTE_LIMITS)) {
      flushPendingCluster();
      out.push(candidate);
      lastPlotted = candidate;
      continue;
    }

    pendingCluster.push(candidate);
    flushPendingCluster();
  }

  flushPendingCluster();
  return out;
}

/**
 * History analytics: drop LBS / approximate fixes and implausible jumps (no held coords).
 */
export function resolveHistoryPositions(points) {
  if (!Array.isArray(points) || points.length === 0) return [];

  const trustedRaw = [];
  for (const p of points) {
    if (!p || Number.isNaN(Number(p.lat)) || Number.isNaN(Number(p.lng))) continue;
    if (hasSevereDeviceClockSkew(p)) continue;
    const candidate = {
      ...p,
      lat: Number(p.lat),
      lng: Number(p.lng),
      speed: sanitizeSpeedKmh(p.speed),
    };
    if (!isTrustedGpsFix(candidate)) continue;
    trustedRaw.push(candidate);
  }

  let prevTrusted = null;
  const out = [];

  for (const candidate of excludeFarGpsOutliers(trustedRaw)) {
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

  if (!hasPlausibleMapCoords(pt)) {
    if (anchor && hasPlausibleMapCoords(anchor)) {
      return {
        ...pt,
        lat: Number(anchor.lat),
        lng: Number(anchor.lng),
        positionHeldFromPreviousGps: true,
      };
    }
    return { ...pt, lat: null, lng: null, positionHiddenApproximate: true };
  }

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
