import {
  kmBetween,
  pointReceivedIso,
  pointTimestampMs,
  resolveHistoryRoutePositions,
  sanitizeSpeedKmh,
} from '../tracking/positionFilter';

/** Minimum route length to count as a walk (km). */
export const MIN_WALK_KM = 0.15;
/** Minimum active span (minutes). */
export const MIN_WALK_MIN = 5;
/** Gap between fixes that ends a walk segment (minutes). */
export const MAX_GAP_MIN = 10;
/** Average speed above this is treated as vehicle travel, not a walk. */
export const MAX_AVG_SPEED_KMH = 14;
const MIN_MOVING_SPEED_KMH = 0.4;
const REST_SPEED_KMH = 0.5;

function sortPoints(points) {
  return [...points].sort((a, b) => (pointTimestampMs(a) ?? 0) - (pointTimestampMs(b) ?? 0));
}

function segmentSpeedKmh(prev, next) {
  const t0 = pointTimestampMs(prev);
  const t1 = pointTimestampMs(next);
  if (t0 == null || t1 == null || t1 <= t0) return null;
  const distKm = kmBetween(prev, next);
  return (distKm / ((t1 - t0) / 1000)) * 3600;
}

function isRestPoint(point, prev) {
  const speed = sanitizeSpeedKmh(point?.speed);
  if (speed != null) return speed < REST_SPEED_KMH;
  if (!prev) return true;
  const seg = segmentSpeedKmh(prev, point);
  return seg == null || seg < REST_SPEED_KMH;
}

function isMovingPoint(point, prev) {
  if (!prev || point?.positionHeldFromPreviousGps) return false;
  const speed = sanitizeSpeedKmh(point?.speed);
  if (speed != null) {
    return speed >= MIN_MOVING_SPEED_KMH && speed <= MAX_AVG_SPEED_KMH * 1.25;
  }
  const seg = segmentSpeedKmh(prev, point);
  return seg != null && seg >= MIN_MOVING_SPEED_KMH && seg <= MAX_AVG_SPEED_KMH * 1.25;
}

function finalizeSegment(raw) {
  const pts = raw.points;
  if (!pts || pts.length < 2) return null;

  let distanceKm = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].positionHeldFromPreviousGps) continue;
    distanceKm += kmBetween(pts[i - 1], pts[i]);
  }

  const startMs = raw.startMs ?? pointTimestampMs(pts[0]);
  const endMs = raw.endMs ?? pointTimestampMs(pts[pts.length - 1]);
  if (startMs == null || endMs == null || endMs <= startMs) return null;

  const durationMin = (endMs - startMs) / 60000;
  if (distanceKm < MIN_WALK_KM || durationMin < MIN_WALK_MIN) return null;

  const avgSpeedKmh = distanceKm / (durationMin / 60);
  if (avgSpeedKmh > MAX_AVG_SPEED_KMH) return null;

  const startAt = new Date(startMs).toISOString();
  const endAt = new Date(endMs).toISOString();
  const distanceRounded = Math.round(distanceKm * 100) / 100;

  return {
    startAt,
    endAt,
    distanceKm: distanceRounded,
    durationMin: Math.max(1, Math.round(durationMin)),
    dedupeKey: `${Math.floor(startMs / 60000)}-${Math.floor(endMs / 60000)}-${Math.round(distanceRounded * 100)}`,
  };
}

/**
 * Detect plausible walk segments from collar GPS history.
 * @param {Array<object>} points Raw history points (sorted internally).
 * @returns {Array<{ startAt, endAt, distanceKm, durationMin, dedupeKey }>}
 */
export function detectWalkSegments(points) {
  if (!Array.isArray(points) || points.length < 2) return [];

  const filtered = resolveHistoryRoutePositions(sortPoints(points));
  if (filtered.length < 2) return [];

  const maxGapMs = MAX_GAP_MIN * 60 * 1000;
  const out = [];
  let current = null;

  for (let i = 1; i < filtered.length; i++) {
    const prev = filtered[i - 1];
    const p = filtered[i];
    const tPrev = pointTimestampMs(prev);
    const tCur = pointTimestampMs(p);
    if (tPrev == null || tCur == null) continue;

    const gapMs = tCur - tPrev;
    const moving = isMovingPoint(p, prev) && !isRestPoint(p, prev);

    if (moving) {
      if (!current) {
        current = { points: [prev, p], startMs: tPrev, endMs: tCur };
        continue;
      }
      if (gapMs <= maxGapMs) {
        current.points.push(p);
        current.endMs = tCur;
      } else {
        const seg = finalizeSegment(current);
        if (seg) out.push(seg);
        current = { points: [prev, p], startMs: tPrev, endMs: tCur };
      }
      continue;
    }

    if (current && gapMs > maxGapMs) {
      const seg = finalizeSegment(current);
      if (seg) out.push(seg);
      current = null;
    }
  }

  if (current) {
    const seg = finalizeSegment(current);
    if (seg) out.push(seg);
  }

  return out;
}

export function gpsWalkKey(deviceId, suggestion) {
  const id = String(deviceId || '').trim();
  return `${id}|${suggestion.dedupeKey}`;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const a0 = new Date(aStart).getTime();
  const a1 = new Date(aEnd).getTime();
  const b0 = new Date(bStart).getTime();
  const b1 = new Date(bEnd).getTime();
  if (![a0, a1, b0, b1].every(Number.isFinite)) return false;
  return a0 <= b1 && b0 <= a1;
}

/**
 * Drop suggestions already logged or dismissed.
 */
export function filterWalkSuggestions(suggestions, { walkSessions = [], dismissedKeys = [], deviceId } = {}) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return [];
  const dismissed = new Set(Array.isArray(dismissedKeys) ? dismissedKeys : []);

  return suggestions.filter((s) => {
    const key = gpsWalkKey(deviceId, s);
    if (dismissed.has(key)) return false;

    for (const sess of walkSessions) {
      if (!sess || typeof sess !== 'object') continue;
      if (sess.gpsKey === key) return false;
      if (sess.source === 'gps' && sess.startedAt && sess.endedAt && rangesOverlap(sess.startedAt, sess.endedAt, s.startAt, s.endAt)) {
        return false;
      }
    }
    return true;
  });
}

/** Keep only segments whose start falls on the local calendar day. */
export function suggestionsForLocalDay(suggestions, dayKey, tzDate = new Date()) {
  const target = dayKey || `${tzDate.getFullYear()}-${String(tzDate.getMonth() + 1).padStart(2, '0')}-${String(tzDate.getDate()).padStart(2, '0')}`;
  return (suggestions || []).filter((s) => {
    const iso = s.startAt || pointReceivedIso(s);
    if (!iso) return false;
    const d = new Date(iso);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key === target;
  });
}
