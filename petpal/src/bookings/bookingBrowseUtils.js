/** @typedef {'vet'|'saloon'|'hotel'|'bath'} ServiceTabId */

/**
 * @param {Record<string, unknown>} p
 * @param {ServiceTabId} tabId
 */
export function providerMatchesServiceTab(p, tabId) {
  const pt = p?.providerTypes && typeof p.providerTypes === 'object' ? p.providerTypes : {};
  if (tabId === 'vet') return Boolean(pt.vet);
  if (tabId === 'bath') return Boolean(pt.bath || pt.saloon);
  if (tabId === 'saloon') return Boolean(pt.saloon);
  if (tabId === 'hotel') return Boolean(pt.hotel);
  return true;
}

/**
 * @param {Record<string, unknown>} p
 * @param {string} q
 */
export function matchesSearch(p, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  return (
    String(p.displayName || '')
      .toLowerCase()
      .includes(s) ||
    String(p.address || '')
      .toLowerCase()
      .includes(s) ||
    String(p.phone || '')
      .toLowerCase()
      .includes(s)
  );
}

/**
 * @param {number} rating
 * @param {'any'|'4'|'4.5'} filter
 */
export function matchesRatingFilter(rating, filter) {
  if (filter === 'any') return true;
  const r = Number(rating);
  if (!Number.isFinite(r) || r <= 0) return false;
  if (filter === '4') return r >= 4;
  if (filter === '4.5') return r >= 4.5;
  return true;
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const r = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(r * c * 10) / 10;
}

/** @param {unknown} v */
function finiteCoord(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Map pin for a provider: flat lat/lng, numeric strings, or GeoPoint-like { latitude, longitude }.
 * @param {Record<string, unknown>} p
 * @returns {{ lat: number, lng: number } | null}
 */
export function providerLatLng(p) {
  if (!p || typeof p !== 'object') return null;
  const nested = p.geo ?? p.location ?? p.coordinates ?? p.position;
  if (nested && typeof nested === 'object') {
    const latRaw = 'latitude' in nested ? nested.latitude : nested.lat;
    const lngRaw = 'longitude' in nested ? nested.longitude : nested.lng;
    const lat = finiteCoord(latRaw);
    const lng = finiteCoord(lngRaw);
    if (lat != null && lng != null) return { lat, lng };
  }
  const lat = finiteCoord(p.lat);
  const lng = finiteCoord(p.lng);
  if (lat != null && lng != null) return { lat, lng };
  return null;
}

/**
 * @param {Record<string, unknown>} p
 * @param {{ lat: number, lng: number } | null} userLoc
 */
export function providerDistanceKm(p, userLoc) {
  if (!userLoc) return null;
  const ll = providerLatLng(p);
  if (!ll) return null;
  return haversineKm(userLoc.lat, userLoc.lng, ll.lat, ll.lng);
}

/**
 * True when a provider should appear as “recommended” in UI (honours optional `boostUntil`).
 * @param {Record<string, unknown> | null | undefined} p
 */
export function providerBoostIsActive(p) {
  if (!p || typeof p !== 'object') return false;
  const flagged = Boolean(p.sponsored || p.recommended || p.boostEnabled);
  if (!flagged) return false;
  const until = p.boostUntil;
  if (until == null) return true;
  let ms = null;
  if (typeof until.toMillis === 'function') ms = until.toMillis();
  else if (typeof until.seconds === 'number') ms = until.seconds * 1000;
  if (ms == null || !Number.isFinite(ms)) return true;
  return ms > Date.now();
}
