import { getCategoryById } from '../config/nearbyPlaceCategories';
import { hasPetCafeSignal } from './nearbyPlaceQuality';

const GOOGLE_TYPE_TO_CATEGORY = {
  pet_store: 'pet_store',
  veterinary_care: 'veterinary_care',
  veterinarian: 'veterinary_care',
  park: 'park',
  beach: 'beach',
};

/** Distinctive services first so mixed “shop + grooming” pins show scissors. */
const NAME_RULES = [
  { id: 'hospital', re: /\b(animal hospital|pet hospital|νοσοκομείο ζώων|вет(?:еринарн)?(?:ая)? больниц)\b/i },
  { id: 'pet_pharmacy', re: /\b(pet\s?pharmacy|animal\s?pharmacy|veterinary\s?pharmacy|φαρμακεί.*ζώ|вет(?:еринарн)?(?:ая)? аптек)\b/i },
  { id: 'veterinary_care', re: /\b(vet(?:erinar(?:y|ian)?)?s?|κτηνίατρ|ветеринар)\b/i },
  { id: 'grooming', re: /\b(groom(?:er|ing)?s?|pet spa|dog wash|κουρέμα|γκρουμ|груминг)\b/i },
  { id: 'pet_hotel', re: /\b(board(?:ing)?|kennel|pet hotel|cattery|πανσιόν|ξενοδοχείο)\b/i },
  { id: 'daycare', re: /\b(day\s?care|doggy day|cr[eè]che)\b/i },
  { id: 'trainer', re: /\b(train(?:er|ing)|obedience|agility|behaviour|behavior|εκπαιδευτ)\b/i },
  // Require pet/dog/cat + café — bare “cafe” matches ordinary coffee shops.
  { id: 'pet_cafe', re: /\b((pet|dog|cat)[- ]?(friendly[- ]?)?(caf[eé]|coffee)|cat\s*cafe|dog\s*cafe|pet\s*cafe)\b/i },
  { id: 'beach', re: /\b(pet.?friendly beach|dog beach|dog.?friendly beach|παραλία.*(σκύλ|κατοικίδ)|σκύλ.*παραλία|пляж.*(собак|питом)|собач.*пляж)\b/i },
  { id: 'park', re: /\b(dog park|pet park|off[- ]leash)\b/i },
  { id: 'pet_store', re: /\b(pet shop|pet store|pet supplies|accessories|zooshop)\b/i },
];

const SPECIFICITY = [
  'hospital',
  'pet_pharmacy',
  'veterinary_care',
  'grooming',
  'pet_hotel',
  'daycare',
  'trainer',
  'pet_cafe',
  'beach',
  'park',
  'pet_store',
];

function placeText(place) {
  return `${place?.name || ''} ${place?.vicinity || ''} ${place?.formatted_address || ''}`;
}

function categoryFromName(place) {
  const hay = placeText(place);
  for (const rule of NAME_RULES) {
    if (rule.re.test(hay)) return rule.id;
  }
  return null;
}

function categoryFromGoogleTypes(place) {
  const types = Array.isArray(place?.types) ? place.types : [];
  for (const type of types) {
    const id = GOOGLE_TYPE_TO_CATEGORY[type];
    if (id) return id;
  }
  return null;
}

function categoryFromSearchSources(place) {
  const sources = Array.isArray(place?.nearbySourceCategoryIds)
    ? place.nearbySourceCategoryIds.filter(Boolean)
    : [];
  const usable = sources.filter((id) => id !== 'pet_cafe' || hasPetCafeSignal(place));
  if (usable.length === 1) return usable[0];
  if (usable.length > 1) {
    for (const id of SPECIFICITY) {
      if (usable.includes(id)) return id;
    }
    return usable[0];
  }
  return null;
}

/**
 * Pick a Nearby category for a Google Place so map pins can use the matching icon.
 * When the user already filtered to one category (not “All pet services”), keep that.
 *
 * @param {google.maps.places.PlaceResult & { nearbySourceCategoryIds?: string[] }} place
 * @param {{ fallbackId?: string }} [options]
 * @returns {string}
 */
export function classifyNearbyPlace(place, options = {}) {
  const fallbackId = options.fallbackId;
  if (fallbackId && fallbackId !== 'more') return fallbackId;

  return (
    categoryFromName(place) ||
    categoryFromGoogleTypes(place) ||
    categoryFromSearchSources(place) ||
    fallbackId ||
    'more'
  );
}

export function nearbyCategoryForPlace(place, selectedCategoryId, t) {
  const id = classifyNearbyPlace(place, { fallbackId: selectedCategoryId });
  return getCategoryById(id, t);
}
