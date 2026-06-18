import {
  kmBetween,
  pointTimestampMs,
  resolveHistoryRoutePositions,
} from '../tracking/positionFilter';
import { gpsWalkKey } from './walkDetection';
import { localDayKey } from './walkStats';

const HOME_CELL = 0.00085;
const HOME_RADIUS_KM = 0.12;
const MIN_TRIP_KM = 0.15;
const MIN_AWAY_MIN = 3;
const MAX_STEP_KM = 2;

function sortPoints(points) {
  return [...(points || [])].sort((a, b) => (pointTimestampMs(a) ?? 0) - (pointTimestampMs(b) ?? 0));
}

export function estimateHomePoint(points) {
  const counts = new Map();
  for (const p of points || []) {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const rLat = Math.round(lat / HOME_CELL) * HOME_CELL;
    const rLng = Math.round(lng / HOME_CELL) * HOME_CELL;
    const key = `${rLat.toFixed(5)},${rLng.toFixed(5)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = null;
  let bestN = 0;
  for (const [key, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = key;
    }
  }
  if (!best) return null;
  const [lat, lng] = best.split(',').map(Number);
  return { lat, lng };
}

function distToHome(point, home) {
  if (!home || !point) return Infinity;
  return kmBetween(point, home);
}

/**
 * Sum haversine distance between consecutive GPS fixes (skips jumps and held positions).
 */
export function totalKmFromPoints(points) {
  const filtered = resolveHistoryRoutePositions(sortPoints(points));
  if (filtered.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < filtered.length; i++) {
    if (filtered[i].positionHeldFromPreviousGps) continue;
    const d = kmBetween(filtered[i - 1], filtered[i]);
    if (d > MAX_STEP_KM) continue;
    sum += d;
  }
  return Math.round(sum * 100) / 100;
}

function dayKeyFromPoint(p) {
  const ms = pointTimestampMs(p);
  if (ms == null) return null;
  return localDayKey(new Date(ms));
}

/**
 * Group points by local calendar day.
 */
export function pointsByLocalDay(points) {
  /** @type {Record<string, object[]>} */
  const out = {};
  for (const p of sortPoints(points)) {
    const key = dayKeyFromPoint(p);
    if (!key) continue;
    if (!out[key]) out[key] = [];
    out[key].push(p);
  }
  return out;
}

/**
 * Detect round trips: leave home radius, travel, return home.
 */
export function detectHomeRoundTrips(points, home) {
  if (!home) return [];
  const filtered = resolveHistoryRoutePositions(sortPoints(points));
  if (filtered.length < 3) return [];

  const trips = [];
  let state = 'home';
  let awayStart = null;
  let awayPoints = [];
  let tripStartMs = null;

  const finalize = () => {
    if (!awayPoints.length || tripStartMs == null) return;
    const endMs = pointTimestampMs(awayPoints[awayPoints.length - 1]);
    if (endMs == null || endMs <= tripStartMs) return;
    const durationMin = (endMs - tripStartMs) / 60000;
    const distanceKm = totalKmFromPoints(awayPoints);
    if (distanceKm < MIN_TRIP_KM || durationMin < MIN_AWAY_MIN) return;
    const startAt = new Date(tripStartMs).toISOString();
    const endAt = new Date(endMs).toISOString();
    const distanceRounded = Math.round(distanceKm * 100) / 100;
    trips.push({
      startAt,
      endAt,
      distanceKm: distanceRounded,
      durationMin: Math.max(1, Math.round(durationMin)),
      dedupeKey: `home-${Math.floor(tripStartMs / 60000)}-${Math.floor(endMs / 60000)}-${Math.round(distanceRounded * 100)}`,
    });
  };

  for (let i = 0; i < filtered.length; i++) {
    const p = filtered[i];
    const t = pointTimestampMs(p);
    if (t == null) continue;
    const atHome = distToHome(p, home) <= HOME_RADIUS_KM;

    if (state === 'home') {
      if (!atHome) {
        state = 'away';
        awayStart = p;
        awayPoints = [awayStart];
        tripStartMs = t;
      }
      continue;
    }

    awayPoints.push(p);
    if (atHome && awayPoints.length >= 2) {
      finalize();
      state = 'home';
      awayStart = null;
      awayPoints = [];
      tripStartMs = null;
    }
  }

  return trips;
}

export function kmByDayFromPoints(points, dayKeys) {
  const grouped = pointsByLocalDay(points);
  /** @type {Record<string, number>} */
  const out = {};
  for (const key of dayKeys) {
    out[key] = totalKmFromPoints(grouped[key] || []);
  }
  return out;
}

export function homeTripKey(deviceId, trip) {
  return gpsWalkKey(deviceId, trip);
}
