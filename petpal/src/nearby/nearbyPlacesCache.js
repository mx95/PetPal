/** In-memory Nearby Search cache — avoids repeat Places API billing within a session. */

export const NEARBY_PLACES_CACHE_TTL_MS = 10 * 60 * 1000;
const COORD_PRECISION = 3; // ~111 m — small GPS drift should not bust cache

/** @type {Map<string, { places: unknown[], at: number, ttl: number }>} */
const store = new Map();

export function roundNearbyCoord(value) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** COORD_PRECISION;
  return Math.round(value * factor) / factor;
}

/**
 * @param {{ categoryId: string, scope: 'radius' | 'bounds', center: { lat: number, lng: number }, bounds?: google.maps.LatLngBounds | null }} input
 */
export function nearbyPlacesCacheKey({ categoryId, scope, center, bounds = null }) {
  const lat = roundNearbyCoord(center.lat);
  const lng = roundNearbyCoord(center.lng);
  if (scope === 'bounds' && bounds) {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    return `${categoryId}|bounds|${roundNearbyCoord(ne.lat())}|${roundNearbyCoord(ne.lng())}|${roundNearbyCoord(sw.lat())}|${roundNearbyCoord(sw.lng())}`;
  }
  return `${categoryId}|radius|${lat}|${lng}`;
}

/**
 * @param {string} key
 * @returns {unknown[] | null}
 */
export function getNearbyPlacesCache(key) {
  const row = store.get(key);
  if (!row) return null;
  if (Date.now() - row.at > row.ttl) {
    store.delete(key);
    return null;
  }
  return row.places;
}

/**
 * @param {string} key
 * @param {unknown[]} places
 * @param {number} [ttlMs]
 */
export function setNearbyPlacesCache(key, places, ttlMs = NEARBY_PLACES_CACHE_TTL_MS) {
  store.set(key, { places, at: Date.now(), ttl: ttlMs });
}

export function clearNearbyPlacesCache() {
  store.clear();
}
