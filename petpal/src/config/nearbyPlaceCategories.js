/**
 * Google Places (Nearby Search) – pet-focused categories.
 * @see https://developers.google.com/maps/documentation/javascript/place_types
 *
 * Labels are translated via i18n: `nearbyPage.cats.<id>.label` / `.desc`
 */

export const NEARBY_SEARCH_RADIUS_M = 5000;

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
    id: 'beach',
    icon: '🏖️',
    type: 'beach',
    keyword: 'dog pet friendly',
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
