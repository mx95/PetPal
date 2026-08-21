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
    keyword: 'pet friendly cafe',
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

export function getCategoryById(id, t) {
  const c = NEARBY_CATEGORIES.find((x) => x.id === id) || NEARBY_CATEGORIES[0];
  if (typeof t !== 'function') return c;
  return {
    ...c,
    label: t(`nearbyPage.cats.${c.id}.label`),
    description: t(`nearbyPage.cats.${c.id}.desc`),
  };
}
