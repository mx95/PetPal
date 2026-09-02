import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { NEARBY_CATEGORIES, NEARBY_SEARCH_RADIUS_M } from '../config/nearbyPlaceCategories';
import { getDb, isFirebaseConfigured } from '../firebase';
import { nearbyRegionsForSearch } from './nearbyRegions';
import { placeInsideBounds, placeWithinRadiusKm, toMapPlace } from './placeMapUtils';

const CACHE_COLLECTION = 'nearbyPlacesCache';
const META_DOC = 'adminConfig/nearbyPlaces';

/** @type {Map<string, Promise<unknown[]>>} */
const inflight = new Map();

async function readPlacesDoc(docId) {
  const db = getDb();
  const ref = doc(db, CACHE_COLLECTION, docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  const chunkCount = Number(data.chunkCount) || 0;
  if (!chunkCount) {
    return Array.isArray(data.places) ? data.places : [];
  }
  const chunkSnap = await getDocs(collection(db, CACHE_COLLECTION, docId, 'chunks'));
  const rows = [];
  chunkSnap.docs
    .sort((a, b) => Number(a.id) - Number(b.id))
    .forEach((chunk) => {
      const places = chunk.data()?.places;
      if (Array.isArray(places)) rows.push(...places);
    });
  return rows;
}

/**
 * @param {string} region
 * @param {string} categoryId
 */
async function loadRegionCategoryPlaces(region, categoryId) {
  const key = `${region}_${categoryId}`;
  if (inflight.has(key)) return inflight.get(key);
  const promise = readPlacesDoc(key).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * @returns {Promise<{ lastRefreshAt?: import('firebase/firestore').Timestamp, status?: string } | null>}
 */
export async function fetchNearbyCacheMeta() {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(getDb(), 'adminConfig', 'nearbyPlaces'));
  return snap.exists() ? snap.data() : null;
}

/**
 * Load cached places from Firestore (CY + GR), filtered to the active search area.
 * Does not call Google Places API.
 *
 * @param {{
 *   categoryId: string,
 *   center: { lat: number, lng: number },
 *   scope: 'radius' | 'bounds',
 *   mapBounds?: google.maps.LatLngBounds | null,
 * }} input
 */
export async function fetchCachedNearbyPlaces(input) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const { categoryId, center, scope, mapBounds = null } = input;
  const regions = nearbyRegionsForSearch(center.lat, center.lng);
  const categoryIds =
    categoryId === 'more'
      ? NEARBY_CATEGORIES.filter((c) => c.id !== 'more').map((c) => c.id)
      : [categoryId];

  /** @type {Map<string, Record<string, unknown>>} */
  const byId = new Map();

  for (const region of regions) {
    for (const catId of categoryIds) {
      // eslint-disable-next-line no-await-in-loop
      const rows = await loadRegionCategoryPlaces(region, catId);
      rows.forEach((row) => {
        const mapped = toMapPlace(row, catId);
        if (!mapped?.place_id) return;
        const prev = byId.get(mapped.place_id);
        if (!prev) {
          byId.set(mapped.place_id, mapped);
          return;
        }
        const ids = new Set([
          ...(Array.isArray(prev.nearbySourceCategoryIds) ? prev.nearbySourceCategoryIds : []),
          ...(Array.isArray(mapped.nearbySourceCategoryIds) ? mapped.nearbySourceCategoryIds : []),
        ]);
        prev.nearbySourceCategoryIds = [...ids];
      });
    }
  }

  const radiusKm = NEARBY_SEARCH_RADIUS_M / 1000;
  let list = [...byId.values()];

  if (scope === 'bounds' && mapBounds) {
    list = list.filter((p) => placeInsideBounds(p, mapBounds));
  } else {
    list = list.filter((p) => placeWithinRadiusKm(p, center, radiusKm));
  }

  return list;
}

export { META_DOC, CACHE_COLLECTION };
