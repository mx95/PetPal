/** @typedef {'vet'|'saloon'|'hotel'} ServiceTabId */

/**
 * @param {Record<string, unknown>} p
 * @param {ServiceTabId} tabId
 */
export function providerMatchesServiceTab(p, tabId) {
  const pt = p?.providerTypes && typeof p.providerTypes === 'object' ? p.providerTypes : {};
  if (tabId === 'vet') return Boolean(pt.vet);
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

/**
 * @param {number|undefined} tier 1–3
 * @param {'any'|'1'|'2'|'3'} filter
 */
export function matchesPriceTierFilter(tier, filter) {
  if (filter === 'any') return true;
  const t = Number(tier);
  if (!Number.isFinite(t)) return true;
  return String(Math.min(3, Math.max(1, Math.round(t)))) === filter;
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

/**
 * @param {Record<string, unknown>} p
 * @param {{ lat: number, lng: number } | null} userLoc
 */
export function providerDistanceKm(p, userLoc) {
  if (!userLoc) return null;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return haversineKm(userLoc.lat, userLoc.lng, lat, lng);
}
