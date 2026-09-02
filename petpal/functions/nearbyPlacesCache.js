/**
 * Server-side Google Places cache for Cyprus & Greece.
 * Scheduled refresh on the 1st and 15th of each month (03:00 Europe/Nicosia).
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {
  NEARBY_CATEGORIES,
  PET_CAFE_EXTRA_SEARCHES,
  NEARBY_CACHE_REGIONS,
  CACHEABLE_CATEGORY_IDS,
  nearbySearchFields,
} = require('./nearbyPlaceCategories');
const { filterAcceptableNearbyPlaces } = require('./nearbyPlaceQuality');

const COLLECTION = 'nearbyPlacesCache';
const META_DOC = 'adminConfig/nearbyPlaces';
const PLACES_CHUNK_SIZE = 400;
const REQUEST_GAP_MS = 400;
const NEARBY_SEARCH_MAX_PAGES = 1;

function ensureAdminApp() {
  try {
    admin.app();
  } catch {
    admin.initializeApp();
  }
}

function getConfig(path, fallback = null) {
  try {
    const cfg = functions.config && functions.config();
    if (!cfg) return fallback;
    return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : null), cfg) ?? fallback;
  } catch {
    return fallback;
  }
}

function getPlacesApiKey(override = null) {
  const fromOverride = override != null ? String(override).trim() : '';
  if (fromOverride) return fromOverride;
  const key =
    process.env.GOOGLE_PLACES_API_KEY ||
    getConfig('places.key') ||
    process.env.GOOGLE_MAPS_API_KEY ||
    getConfig('google.maps_key');
  if (!key || !String(key).trim()) {
    throw new Error(
      'Missing GOOGLE_PLACES_API_KEY (or functions.config().places.key) for Nearby cache refresh.'
    );
  }
  return String(key).trim();
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function gridPoints(region) {
  const points = [];
  for (let lat = region.latMin; lat < region.latMax; lat += region.gridStep) {
    for (let lng = region.lngMin; lng < region.lngMax; lng += region.gridStep) {
      points.push({
        lat: Math.round((lat + region.gridStep / 2) * 1000) / 1000,
        lng: Math.round((lng + region.gridStep / 2) * 1000) / 1000,
      });
    }
  }
  return points;
}

function serializePlace(result, sourceCategoryId) {
  const lat = result?.geometry?.location?.lat;
  const lng = result?.geometry?.location?.lng;
  if (!result?.place_id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    place_id: result.place_id,
    name: result.name || '',
    lat,
    lng,
    vicinity: result.vicinity || result.formatted_address || '',
    rating: result.rating ?? null,
    user_ratings_total: result.user_ratings_total ?? null,
    types: Array.isArray(result.types) ? result.types : [],
    business_status: result.business_status || null,
    nearbySourceCategoryIds: sourceCategoryId ? [sourceCategoryId] : [],
  };
}

async function nearbySearchOnce({ lat, lng, radius, fields, apiKey, pageToken = null }) {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radius),
    key: apiKey,
  });
  if (fields.type) params.set('type', fields.type);
  if (fields.keyword) params.set('keyword', fields.keyword);
  if (pageToken) params.set('pagetoken', pageToken);

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Places HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.status === 'OVER_QUERY_LIMIT') {
    const err = new Error('Places OVER_QUERY_LIMIT');
    err.code = 'OVER_QUERY_LIMIT';
    throw err;
  }
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new Error(`Places status ${json.status}: ${json.error_message || ''}`.trim());
  }
  return json;
}

async function nearbySearchAllPages(args) {
  let pageToken = null;
  /** @type {any[]} */
  const merged = [];
  for (let page = 0; page < NEARBY_SEARCH_MAX_PAGES; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const json = await nearbySearchOnce({ ...args, pageToken });
    if (Array.isArray(json.results)) merged.push(...json.results);
    if (!json.next_page_token) break;
    pageToken = json.next_page_token;
  }
  return merged;
}

async function runNearbyQueryWithRetry(args, retries = 0) {
  try {
    return await nearbySearchAllPages(args);
  } catch (e) {
    if (e?.code === 'OVER_QUERY_LIMIT' && retries > 0) {
      await sleep(1200);
      return runNearbyQueryWithRetry(args, retries - 1);
    }
    functions.logger.warn('Nearby query failed', {
      lat: args.lat,
      lng: args.lng,
      message: e?.message || String(e),
    });
    return [];
  }
}

function mergeSerialized(into, place, sourceCategoryId) {
  if (!place?.place_id) return;
  const prev = into.get(place.place_id);
  if (!prev) {
    into.set(place.place_id, place);
    return;
  }
  const ids = new Set(prev.nearbySourceCategoryIds || []);
  if (sourceCategoryId) ids.add(sourceCategoryId);
  prev.nearbySourceCategoryIds = [...ids];
}

async function collectCategoryPlaces(regionId, category, apiKey) {
  const region = NEARBY_CACHE_REGIONS[regionId];
  const byId = new Map();
  const points = gridPoints(region);
  const queries =
    category.id === 'pet_cafe'
      ? [{ ...category }, ...PET_CAFE_EXTRA_SEARCHES]
      : [{ ...category }];

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    for (let q = 0; q < queries.length; q += 1) {
      const fields = nearbySearchFields(queries[q]);
      // eslint-disable-next-line no-await-in-loop
      const results = await runNearbyQueryWithRetry({
        lat: point.lat,
        lng: point.lng,
        radius: region.searchRadiusM,
        fields,
        apiKey,
      });
      results.forEach((row) => {
        const serialized = serializePlace(row, category.id);
        if (serialized) mergeSerialized(byId, serialized, category.id);
      });
      // eslint-disable-next-line no-await-in-loop
      await sleep(REQUEST_GAP_MS);
    }
  }

  return filterAcceptableNearbyPlaces([...byId.values()], {
    selectedCategoryId: category.id,
  });
}

async function writePlacesDoc(db, docId, payload) {
  const { places, ...meta } = payload;
  const ref = db.collection(COLLECTION).doc(docId);

  if (!Array.isArray(places) || places.length <= PLACES_CHUNK_SIZE) {
    await ref.set({
      ...meta,
      places: places || [],
      chunkCount: 0,
    });
    return;
  }

  const chunks = [];
  for (let i = 0; i < places.length; i += PLACES_CHUNK_SIZE) {
    chunks.push(places.slice(i, i + PLACES_CHUNK_SIZE));
  }

  await ref.set({
    ...meta,
    places: [],
    chunkCount: chunks.length,
  });

  const chunkCol = ref.collection('chunks');
  for (let i = 0; i < chunks.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await chunkCol.doc(String(i)).set({ places: chunks[i] });
  }
}

async function readPlacesFromDoc(db, docId) {
  const snap = await db.collection(COLLECTION).doc(docId).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const chunkCount = Number(data.chunkCount) || 0;
  if (!chunkCount) {
    return data;
  }
  const chunkSnaps = await db.collection(COLLECTION).doc(docId).collection('chunks').get();
  const places = [];
  chunkSnaps.docs
    .sort((a, b) => Number(a.id) - Number(b.id))
    .forEach((doc) => {
      const rows = doc.data()?.places;
      if (Array.isArray(rows)) places.push(...rows);
    });
  return { ...data, places };
}

async function refreshAllNearbyPlacesCache(apiKeyOverride = null) {
  ensureAdminApp();
  const db = admin.firestore();
  const apiKey = getPlacesApiKey(apiKeyOverride);
  const startedAt = admin.firestore.FieldValue.serverTimestamp();
  let tileCount = 0;

  await db.doc(META_DOC).set(
    {
      status: 'running',
      startedAt,
      regions: Object.keys(NEARBY_CACHE_REGIONS),
      categories: CACHEABLE_CATEGORY_IDS,
    },
    { merge: true }
  );

  for (const regionId of Object.keys(NEARBY_CACHE_REGIONS)) {
    for (const category of NEARBY_CATEGORIES) {
      functions.logger.info('Refreshing nearby cache', { regionId, categoryId: category.id });
      // eslint-disable-next-line no-await-in-loop
      const places = await collectCategoryPlaces(regionId, category, apiKey);
      const docId = `${regionId}_${category.id}`;
      // eslint-disable-next-line no-await-in-loop
      await writePlacesDoc(db, docId, {
        region: regionId,
        categoryId: category.id,
        places,
        refreshedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tileCount += 1;
      functions.logger.info('Nearby cache doc written', {
        docId,
        placeCount: places.length,
      });
    }
  }

  await db.doc(META_DOC).set(
    {
      status: 'ready',
      lastRefreshAt: admin.firestore.FieldValue.serverTimestamp(),
      tileCount,
      regions: Object.keys(NEARBY_CACHE_REGIONS),
      categories: CACHEABLE_CATEGORY_IDS,
      schedule: '0 3 1,15 * * Europe/Nicosia',
    },
    { merge: true }
  );

  return { tileCount };
}

async function requireCallerAdmin(context) {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  }
  ensureAdminApp();
  const snap = await admin.firestore().doc(`admins/${context.auth.uid}`).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
}

const refreshRuntime = { timeoutSeconds: 540, memory: '1GB' };

exports.refreshNearbyPlacesCache = functions
  .region('europe-west1')
  .runWith(refreshRuntime)
  .pubsub.schedule('0 3 1,15 * *')
  .timeZone('Europe/Nicosia')
  .onRun(async () => {
    try {
      const result = await refreshAllNearbyPlacesCache();
      functions.logger.info('Nearby Places cache refresh complete', result);
    } catch (e) {
      ensureAdminApp();
      await admin
        .firestore()
        .doc(META_DOC)
        .set(
          {
            status: 'error',
            lastError: e?.message || String(e),
            lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      functions.logger.error('Nearby Places cache refresh failed', e);
      throw e;
    }
    return null;
  });

exports.bootstrapRefreshNearbyPlacesCache = functions
  .region('europe-west1')
  .runWith(refreshRuntime)
  .https.onCall(async (data, context) => {
    await requireCallerAdmin(context);
    const placesApiKey =
      data && typeof data.placesApiKey === 'string' ? data.placesApiKey.trim() : null;
    const result = await refreshAllNearbyPlacesCache(placesApiKey || null);
    return { ok: true, ...result };
  });

exports.getNearbyPlacesCacheMeta = functions.region('europe-west1').https.onCall(async () => {
  ensureAdminApp();
  const snap = await admin.firestore().doc(META_DOC).get();
  return snap.exists ? snap.data() : { status: 'missing' };
});

module.exports._internal = {
  readPlacesFromDoc,
  collectCategoryPlaces,
  serializePlace,
  gridPoints,
  refreshAllNearbyPlacesCache,
  getPlacesApiKey,
};
