/**
 * Google Places (Nearby Search) – pet-focused categories.
 * @see https://developers.google.com/maps/documentation/javascript/supported_types
 *
 * Only Table 1 types may be sent as Nearby Search `type`. Invalid types
 * (e.g. `beach`) make Google return INVALID_REQUEST.
 *
 * Labels are translated via i18n: `nearbyPage.cats.<id>.label` / `.desc`
 */

export const NEARBY_SEARCH_RADIUS_M = 5000;

/** Legacy Places Nearby Search Table 1 types used by PetPal. */
export const NEARBY_SEARCH_TYPE_WHITELIST = new Set([
  'pet_store',
  'veterinary_care',
  'park',
  'cafe',
]);

/**
 * Build `type` / `keyword` fields for PlacesService.nearbySearch.
 * @param {{ type?: string, keyword?: string }} category
 * @returns {{ type?: string, keyword?: string }}
 */
export function nearbySearchFields(category) {
  const out = {};
  if (category?.type && NEARBY_SEARCH_TYPE_WHITELIST.has(category.type)) {
    out.type = category.type;
  }
  if (category?.keyword) out.keyword = category.keyword;
  if (!out.type && !out.keyword) out.keyword = 'pet';
  return out;
}

export const NEARBY_CATEGORIES = [
  {
    id: 'pet_store',
    icon: '🛍️',
    type: 'pet_store',
  },
  {
    id: 'veterinary_care',
    icon: '🩺',
    type: 'veterinary_care',
  },
  {
    id: 'park',
    icon: '🌳',
    type: 'park',
    keyword: 'dog',
  },
  {
    // `beach` is NOT a valid Places Nearby Search `type` (legacy Table 1) — it
    // returns INVALID_REQUEST. Keyword-only search finds dog/pet beaches.
    id: 'beach',
    icon: '🏖️',
    keyword: 'dog beach pet friendly beach',
  },
  {
    id: 'hospital',
    icon: '🏥',
    keyword: 'animal hospital pet hospital veterinary hospital',
  },
  {
    id: 'pet_hotel',
    icon: '🏨',
    keyword: 'pet hotel boarding',
  },
  {
    id: 'grooming',
    icon: '✂️',
    keyword: 'pet grooming',
  },
  {
    id: 'daycare',
    icon: '☀️',
    keyword: 'pet daycare',
  },
  {
    id: 'trainer',
    icon: '🎓',
    keyword: 'dog trainer pet trainer horse trainer',
  },
  {
    id: 'pet_cafe',
    icon: '☕',
    // Keyword-only (no type=cafe): Google ranks cafés that mention pets welcome /
    // dog-friendly. Cafe tab trusts these hits — names often omit “pet”.
    keyword: 'pet friendly cafe dog friendly cafe pets allowed cafe cat cafe dog cafe',
  },
  {
    id: 'pet_pharmacy',
    icon: '💊',
    keyword: 'pet pharmacy animal pharmacy veterinary pharmacy',
  },
  {
    id: 'more',
    icon: '🔎',
    keyword: 'pet services',
  },
];

/**
 * Extra Nearby Search queries for the Cafe tab (merged with the category request).
 * Separate short queries catch cat cafés / dog cafés Google may rank differently.
 */
export const PET_CAFE_EXTRA_SEARCHES = [
  { keyword: 'pet friendly cafe' },
  { keyword: 'dog friendly cafe' },
  { keyword: 'cat cafe' },
  { keyword: 'pets allowed cafe' },
  // Broad café sweep in the area; Cafe tab still only shows Places keyword hits
  // from this category (and All services keeps ordinary cafés filtered out).
  { type: 'cafe', keyword: 'pet friendly' },
];

export function getCategoryById(id, t) {
  const c = NEARBY_CATEGORIES.find((x) => x.id === id) || NEARBY_CATEGORIES[0];
  if (typeof t !== 'function') return c;
  return {
    ...c,
    label: t(`nearbyPage.cats.${c.id}.label`),
    description: t(`nearbyPage.cats.${c.id}.desc`),
  };
}
