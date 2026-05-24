import { hasPlausibleMapCoords } from './positionFilter';

const HOME_ANCHOR_KEY = 'petpal_home_anchor_v1';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(HOME_ANCHOR_KEY) || '{}');
  } catch {
    return {};
  }
}

/** @param {string} imei @returns {{ lat: number, lng: number }|null} */
export function loadHomeAnchor(imei) {
  if (!imei) return null;
  const entry = readAll()[imei];
  if (!entry || !hasPlausibleMapCoords(entry)) return null;
  return { lat: Number(entry.lat), lng: Number(entry.lng) };
}

/** @param {string} imei @param {number} lat @param {number} lng */
export function saveHomeAnchor(imei, lat, lng) {
  if (!imei || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (!hasPlausibleMapCoords({ lat, lng })) return;
  try {
    const all = readAll();
    all[imei] = { lat, lng, savedAt: Date.now() };
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

/**
 * When a collar has Wi‑Fi reports but no GPS yet, use the dominant map cluster as a coarse home zone.
 * @param {Array<{ lat?: number, lng?: number, source?: string }>} history
 */
export function inferProvisionalHomeFromHistory(history) {
  if (!Array.isArray(history) || history.length < 3) return null;
  const wifiLike = history.filter((p) => {
    if (!hasPlausibleMapCoords(p)) return false;
    const src = String(p.source || '').toLowerCase();
    return src === 'wifi' || src === 'lbs' || src === '';
  });
  if (wifiLike.length < 3) return null;

  const clusters = new Map();
  for (const p of wifiLike) {
    const key = `${Number(p.lat).toFixed(2)},${Number(p.lng).toFixed(2)}`;
    const prev = clusters.get(key);
    if (prev) {
      prev.n += 1;
      prev.latSum += Number(p.lat);
      prev.lngSum += Number(p.lng);
    } else {
      clusters.set(key, { n: 1, latSum: Number(p.lat), lngSum: Number(p.lng) });
    }
  }

  let best = null;
  let bestN = 0;
  for (const c of clusters.values()) {
    if (c.n > bestN) {
      bestN = c.n;
      best = c;
    }
  }
  if (!best || bestN < Math.max(3, Math.floor(wifiLike.length * 0.45))) return null;

  return {
    lat: best.latSum / best.n,
    lng: best.lngSum / best.n,
    provisional: true,
  };
}
