/**
 * Nearby Search category definitions (Cloud Functions copy).
 * Keep in sync with petpal/src/config/nearbyPlaceCategories.js
 */

const NEARBY_SEARCH_TYPE_WHITELIST = new Set(['pet_store', 'veterinary_care', 'park', 'cafe']);

function nearbySearchFields(category) {
  const out = {};
  if (category?.type && NEARBY_SEARCH_TYPE_WHITELIST.has(category.type)) {
    out.type = category.type;
  }
  if (category?.keyword) out.keyword = category.keyword;
  if (!out.type && !out.keyword) out.keyword = 'pet';
  return out;
}

const NEARBY_CATEGORIES = [
  { id: 'pet_store', type: 'pet_store' },
  { id: 'veterinary_care', type: 'veterinary_care' },
  { id: 'park', type: 'park', keyword: 'dog' },
  { id: 'beach', keyword: 'dog beach pet friendly beach' },
  { id: 'hospital', keyword: 'animal hospital pet hospital veterinary hospital' },
  { id: 'pet_hotel', keyword: 'pet hotel boarding' },
  { id: 'grooming', keyword: 'pet grooming' },
  { id: 'daycare', keyword: 'pet daycare' },
  { id: 'trainer', keyword: 'dog trainer pet trainer horse trainer' },
  { id: 'pet_cafe', keyword: 'pet friendly cafe dog friendly cafe pets allowed cafe cat cafe dog cafe' },
  { id: 'pet_pharmacy', keyword: 'pet pharmacy animal pharmacy veterinary pharmacy' },
];

const PET_CAFE_EXTRA_SEARCHES = [
  { keyword: 'pet friendly cafe' },
  { keyword: 'dog friendly cafe' },
];

/** Regions refreshed twice monthly (1st & 15th, Europe/Nicosia). */
const NEARBY_CACHE_REGIONS = {
  CY: {
    latMin: 34.5,
    latMax: 35.75,
    lngMin: 32.15,
    lngMax: 34.65,
    gridStep: 0.2,
    searchRadiusM: 10000,
  },
  GR: {
    latMin: 34.8,
    latMax: 41.75,
    lngMin: 19.35,
    lngMax: 29.65,
    gridStep: 0.75,
    searchRadiusM: 35000,
  },
};

const CACHEABLE_CATEGORY_IDS = NEARBY_CATEGORIES.map((c) => c.id);

module.exports = {
  NEARBY_CATEGORIES,
  PET_CAFE_EXTRA_SEARCHES,
  NEARBY_CACHE_REGIONS,
  CACHEABLE_CATEGORY_IDS,
  nearbySearchFields,
};
