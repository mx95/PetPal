/**
 * @param {Record<string, unknown>} place
 * @returns {{ lat: number, lng: number } | null}
 */
export function placeLatLng(place) {
  if (Number.isFinite(place?.lat) && Number.isFinite(place?.lng)) {
    return { lat: Number(place.lat), lng: Number(place.lng) };
  }
  const loc = place?.geometry?.location;
  if (!loc) return null;
  const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
  const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/**
 * Firestore rows → map-friendly place objects for markers / list UI.
 * @param {Record<string, unknown>} row
 * @param {string} [sourceCategoryId]
 */
export function toMapPlace(row, sourceCategoryId) {
  const latLng = placeLatLng(row);
  if (!latLng) return null;
  const sourceIds = Array.isArray(row.nearbySourceCategoryIds)
    ? row.nearbySourceCategoryIds.filter(Boolean)
    : sourceCategoryId
      ? [sourceCategoryId]
      : [];
  return {
    ...row,
    geometry: { location: latLng },
    nearbySourceCategoryIds: sourceIds,
  };
}

/**
 * @param {{ lat: number, lng: number }} from
 * @param {Record<string, unknown>} place
 */
export function distanceKm(from, place) {
  const to = placeLatLng(place);
  if (!from || !to) return null;
  const r = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

/**
 * @param {Record<string, unknown>} place
 * @param {google.maps.LatLngBounds} bounds
 */
export function placeInsideBounds(place, bounds) {
  const pt = placeLatLng(place);
  if (!pt || !bounds) return false;
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return pt.lat <= ne.lat() && pt.lat >= sw.lat() && pt.lng <= ne.lng() && pt.lng >= sw.lng();
}

/**
 * @param {Record<string, unknown>} place
 * @param {{ lat: number, lng: number }} center
 * @param {number} radiusKm
 */
export function placeWithinRadiusKm(place, center, radiusKm) {
  const km = distanceKm(center, place);
  return km != null && km <= radiusKm;
}
