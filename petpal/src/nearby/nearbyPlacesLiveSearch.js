import {
  NEARBY_CATEGORIES,
  NEARBY_SEARCH_RADIUS_M,
  PET_CAFE_EXTRA_SEARCHES,
  nearbySearchFields,
} from '../config/nearbyPlaceCategories';

/**
 * Live Google Places Nearby Search — used when the Firestore server cache is empty.
 * Prefer fetchCachedNearbyPlaces when the CY/GR cache is populated.
 *
 * @param {{
 *   map: google.maps.Map,
 *   categoryId: string,
 *   center: { lat: number, lng: number },
 *   scope: 'radius' | 'bounds',
 *   mapBounds?: google.maps.LatLngBounds | null,
 * }} input
 * @returns {Promise<Array<google.maps.places.PlaceResult & { nearbySourceCategoryIds?: string[] }>>}
 */
export async function fetchLiveNearbyPlaces(input) {
  const { map, categoryId, center, scope, mapBounds = null } = input;
  if (!map || !window.google?.maps?.places) {
    throw new Error('Google Places is not available');
  }

  const service = new window.google.maps.places.PlacesService(map);
  const cat = NEARBY_CATEGORIES.find((c) => c.id === categoryId) || NEARBY_CATEGORIES[0];

  if (scope === 'bounds' && !mapBounds) {
    throw new Error('Map bounds are not ready');
  }

  if (cat.id === 'more') {
    return searchAllCategories(service, scope, center, mapBounds);
  }

  if (cat.id === 'pet_cafe') {
    const queries = [{ ...cat }, ...PET_CAFE_EXTRA_SEARCHES];
    const resultsList = await Promise.all(
      queries.map((entry) => runOneSearch(service, entry, scope, center, mapBounds))
    );
    /** @type {Map<string, google.maps.places.PlaceResult & { nearbySourceCategoryIds?: string[] }>} */
    const byId = new Map();
    resultsList.forEach((results) => {
      (results || []).forEach((place) => {
        if (!place.place_id || byId.has(place.place_id)) return;
        byId.set(place.place_id, {
          ...place,
          nearbySourceCategoryIds: ['pet_cafe'],
        });
      });
    });
    return [...byId.values()];
  }

  const results = await runOneSearch(service, cat, scope, center, mapBounds);
  return (results || []).map((place) => ({
    ...place,
    nearbySourceCategoryIds: [cat.id],
  }));
}

/**
 * @param {google.maps.places.PlacesService} service
 * @param {{ type?: string, keyword?: string, id?: string }} entry
 * @param {'radius' | 'bounds'} scope
 * @param {{ lat: number, lng: number }} center
 * @param {google.maps.LatLngBounds | null} mapBounds
 * @param {number} [radiusM]
 */
function runOneSearch(service, entry, scope, center, mapBounds, radiusM = NEARBY_SEARCH_RADIUS_M) {
  return new Promise((resolve) => {
    /** @type {google.maps.places.PlaceSearchRequest} */
    const request = { ...nearbySearchFields(entry) };
    if (scope === 'bounds' && mapBounds) {
      request.bounds = mapBounds;
    } else {
      request.location = new window.google.maps.LatLng(center.lat, center.lng);
      request.radius = radiusM;
    }

    const attempt = (retry) => {
      service.nearbySearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(results);
          return;
        }
        if (
          status === window.google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT &&
          retry < 1
        ) {
          window.setTimeout(() => attempt(retry + 1), 900 * (retry + 1));
          return;
        }
        resolve([]);
      });
    };
    attempt(0);
  });
}

/**
 * @param {google.maps.places.PlacesService} service
 * @param {'radius' | 'bounds'} scope
 * @param {{ lat: number, lng: number }} center
 * @param {google.maps.LatLngBounds | null} mapBounds
 */
async function searchAllCategories(service, scope, center, mapBounds) {
  const sources = NEARBY_CATEGORIES.filter((c) => c.id !== 'more');
  /** @type {Map<string, google.maps.places.PlaceResult & { nearbySourceCategoryIds?: string[] }>} */
  const byId = new Map();
  const BATCH_GAP_MS = 350;
  const radiusM = Math.max(NEARBY_SEARCH_RADIUS_M, 10000);

  for (let i = 0; i < sources.length; i += 1) {
    const entry = sources[i];
    // eslint-disable-next-line no-await-in-loop
    const results = await runOneSearch(service, entry, scope, center, mapBounds, radiusM);
    results.forEach((place) => {
      if (!place.place_id) return;
      const prev = byId.get(place.place_id);
      const ids = new Set(prev?.nearbySourceCategoryIds || []);
      ids.add(entry.id);
      if (prev) {
        prev.nearbySourceCategoryIds = [...ids];
      } else {
        byId.set(place.place_id, {
          ...place,
          nearbySourceCategoryIds: [...ids],
        });
      }
    });
    if (i < sources.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => window.setTimeout(r, BATCH_GAP_MS));
    }
  }

  return [...byId.values()];
}
