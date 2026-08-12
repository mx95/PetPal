import { hasPlausibleMapCoords } from './positionFilter';

const HOME_ANCHOR_KEY = 'petpal_home_anchor_v1';

/** Only anchors the user (or device after user set) explicitly saved — never auto GPS. */
const EXPLICIT_HOME_SOURCES = new Set(['phone', 'map-pin', 'api', 'device', 'user']);

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(HOME_ANCHOR_KEY) || '{}');
  } catch {
    return {};
  }
}

/** @param {{ source?: string }|null|undefined} entry */
export function isExplicitHomeAnchor(entry) {
  if (!entry) return false;
  return EXPLICIT_HOME_SOURCES.has(String(entry.source || ''));
}

/** @returns {{ lat: number, lng: number, source?: string }|null} */
export function loadHomeAnchor(imei) {
  if (!imei) return null;
  const entry = readAll()[imei];
  if (!entry || !hasPlausibleMapCoords(entry)) return null;
  if (!isExplicitHomeAnchor(entry)) return null;
  if (isLikelyBadCellHomeAnchor(entry)) return null;
  return { lat: Number(entry.lat), lng: Number(entry.lng), source: entry.source };
}

/** @param {string} imei @param {number} lat @param {number} lng @param {{ source?: string }} [meta] */
export function saveHomeAnchor(imei, lat, lng, meta = {}) {
  if (!imei || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (!hasPlausibleMapCoords({ lat, lng })) return;
  try {
    const all = readAll();
    all[imei] = { lat, lng, savedAt: Date.now(), source: meta.source || 'gps' };
    localStorage.setItem(HOME_ANCHOR_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** @param {string} imei */
export function clearHomeAnchor(imei) {
  if (!imei) return;
  try {
    const all = readAll();
    delete all[imei];
    localStorage.setItem(HOME_ANCHOR_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** @param {object|null|undefined} position */
export function homeCoordsFromPosition(position) {
  if (!position) return null;
  const lat = position.homeLat != null ? Number(position.homeLat) : Number.NaN;
  const lng = position.homeLng != null ? Number(position.homeLng) : Number.NaN;
  if (!hasPlausibleMapCoords({ lat, lng })) return null;
  return { lat, lng };
}

/** Drop anchors saved from old cell/Wi‑Fi history (not real home GPS). */
export function isLikelyBadCellHomeAnchor(anchor) {
  if (!anchor || !hasPlausibleMapCoords(anchor)) return false;
  const lat = Number(anchor.lat);
  const lng = Number(anchor.lng);
  // Odin history cluster: mislabeled Wi‑Fi + cell tower ~Frenaros (not user's house).
  if (Math.abs(lat - 35.038345) < 0.002 && Math.abs(lng - 33.907032) < 0.002) return true;
  return anchor.source === 'history-inferred';
}
