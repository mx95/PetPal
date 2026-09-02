/** Cyprus & Greece bounds for server-side Nearby Places cache. */

export const NEARBY_CACHE_REGIONS = {
  CY: {
    latMin: 34.5,
    latMax: 35.75,
    lngMin: 32.15,
    lngMax: 34.65,
  },
  GR: {
    latMin: 34.8,
    latMax: 41.75,
    lngMin: 19.35,
    lngMax: 29.65,
  },
};

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {('CY'|'GR')[]}
 */
export function nearbyRegionsForPoint(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ['CY'];
  return /** @type {('CY'|'GR')[]} */ (
    Object.entries(NEARBY_CACHE_REGIONS)
      .filter(
        ([, b]) => lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax
      )
      .map(([id]) => id)
  );
}

/** Pick CY/GR for a search; default Cyprus when outside both boxes. */
export function nearbyRegionsForSearch(lat, lng) {
  const hits = nearbyRegionsForPoint(lat, lng);
  return hits.length ? hits : ['CY'];
}
