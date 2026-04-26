/**
 * Google Places (Nearby Search) – pet-focused categories.
 * @see https://developers.google.com/maps/documentation/javascript/place_types
 *
 * `type` uses a single Places type when available; `keyword` refines or drives
 * keyword-only searches (e.g. “pet hotel” has no single official type).
 */

export const NEARBY_SEARCH_RADIUS_M = 5000;

export const NEARBY_CATEGORIES = [
  {
    id: 'pet_store',
    label: 'Pet shop',
    description: 'Pet stores & supplies',
    icon: '🛍️',
    type: 'pet_store',
  },
  {
    id: 'veterinary_care',
    label: 'Vet',
    description: 'Veterinary clinics',
    icon: '🩺',
    type: 'veterinary_care',
  },
  {
    id: 'park',
    label: 'Pet / dog park',
    description: 'Parks & off-leash areas',
    icon: '🌳',
    type: 'park',
    keyword: 'dog',
  },
  {
    id: 'pet_hotel',
    label: 'Pet hotel & boarding',
    description: 'Boarding, overnight stays',
    icon: '🏨',
    keyword: 'pet hotel boarding',
  },
  {
    id: 'grooming',
    label: 'Grooming',
    description: 'Salons & bath',
    icon: '✂️',
    keyword: 'pet grooming',
  },
  {
    id: 'daycare',
    label: 'Daycare',
    description: 'Pet daycare & play',
    icon: '☀️',
    keyword: 'pet daycare',
  },
  {
    id: 'pet_cafe',
    label: 'Pet café & events',
    description: 'Cafes, meetups, events',
    icon: '☕',
    keyword: 'pet friendly cafe',
  },
  {
    id: 'more',
    label: 'All pet services',
    description: 'Broader local search',
    icon: '🔎',
    keyword: 'pet services',
  },
];

export function getCategoryById(id) {
  return NEARBY_CATEGORIES.find((c) => c.id === id) || NEARBY_CATEGORIES[0];
}
