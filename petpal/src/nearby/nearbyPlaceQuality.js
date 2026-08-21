/**
 * Drop Google Places false positives that match a pet keyword search
 * but are not actually pet-related (e.g. ordinary cafés).
 */

const TRUSTED_GOOGLE_TYPES = new Set(['pet_store', 'veterinary_care', 'veterinarian']);

/** Clear pet / animal wording in name or address (en / el / ru). */
const PET_SIGNAL_RE =
  /\b(pets?|dogs?|cats?|pupp(?:y|ies)|kittens?|animals?|paws?|veterinary|veterinarian|vets?|groom(?:er|ing)?|kennels?|boarding|daycare|doggy|pet[- ]?friendly|cat\s*cafe|dog\s*cafe|pet\s*cafe|ζώα?|σκύλ(?:ος|οι|άκι)?|γατ(?:α|ες|ί)|κτηνίατρ|κατοικίδι|ветеринар|собак|кошк|питомц|зоо)\b/i;

/** Food/drink venues Google often returns for “pet friendly cafe”. */
const FOOD_DRINK_TYPES = new Set([
  'cafe',
  'bar',
  'restaurant',
  'bakery',
  'meal_takeaway',
  'meal_delivery',
  'night_club',
  'food',
]);

/** Keyword categories that commonly return unrelated businesses. */
const NOISY_KEYWORD_CATEGORIES = new Set([
  'pet_cafe',
  'beach',
  'trainer',
  'daycare',
  'pet_hotel',
  'grooming',
  'hospital',
  'pet_pharmacy',
]);

function placeText(place) {
  return `${place?.name || ''} ${place?.vicinity || ''} ${place?.formatted_address || ''}`;
}

function placeTypes(place) {
  return Array.isArray(place?.types) ? place.types : [];
}

function sourceIds(place) {
  return Array.isArray(place?.nearbySourceCategoryIds)
    ? place.nearbySourceCategoryIds.filter(Boolean)
    : [];
}

export function hasPetRelevanceSignal(place) {
  return PET_SIGNAL_RE.test(placeText(place));
}

export function hasTrustedPetGoogleType(place) {
  return placeTypes(place).some((t) => TRUSTED_GOOGLE_TYPES.has(t));
}

function isFoodOrDrinkVenue(place) {
  return placeTypes(place).some((t) => FOOD_DRINK_TYPES.has(t));
}

/** Real pet cafés / pet-friendly cafés — not every place with “cafe” in the name. */
export function hasPetCafeSignal(place) {
  const text = placeText(place);
  if (/\b((pet|dog|cat)[- ]?(friendly[- ]?)?(caf[eé]|coffee)|cat\s*cafe|dog\s*cafe|pet\s*cafe)\b/i.test(text)) {
    return true;
  }
  // “Pet-friendly … Café” / “Café … dogs welcome” style
  return /\b(caf[eé]|coffee)\b/i.test(text) && PET_SIGNAL_RE.test(text);
}

/**
 * Whether a Places result is acceptable for Nearby (not an obvious false positive).
 * @param {google.maps.places.PlaceResult & { nearbySourceCategoryIds?: string[] }} place
 * @param {{ selectedCategoryId?: string }} [options]
 */
export function isAcceptableNearbyPlace(place, options = {}) {
  if (!place?.name && !place?.place_id) return false;

  if (hasTrustedPetGoogleType(place)) return true;

  const types = placeTypes(place);
  const sources = sourceIds(place);
  const selected = options.selectedCategoryId || 'more';
  const text = placeText(place);
  const petSignal = hasPetRelevanceSignal(place);
  const fromPetCafe =
    selected === 'pet_cafe' || sources.includes('pet_cafe');
  const foodDrink = isFoodOrDrinkVenue(place);

  // Parks: keep Google parks when browsing Parks; in All services require dog/pet wording.
  if (types.includes('park')) {
    if (selected === 'park') return true;
    return /\b(dog|pet|off[- ]leash|σκύλ|κατοικίδι|собак|питом)\b/i.test(text);
  }

  // Pet café search: keep only places that look like a pet café (not every café).
  if (fromPetCafe) return hasPetCafeSignal(place);

  // Ordinary food/drink venues with no pet wording are false positives.
  if (foodDrink && !petSignal) return false;

  if (petSignal) return true;

  // No pet wording: drop noisy keyword-only hits (grooming, beach, trainer, …).
  if (sources.length > 0 && sources.every((id) => NOISY_KEYWORD_CATEGORIES.has(id))) {
    return false;
  }
  if (selected !== 'more' && NOISY_KEYWORD_CATEGORIES.has(selected)) {
    return false;
  }

  // Remaining untyped keyword hits without pet wording are not trustworthy.
  return false;
}

/**
 * @template T
 * @param {T[]} places
 * @param {{ selectedCategoryId?: string }} [options]
 * @returns {T[]}
 */
export function filterAcceptableNearbyPlaces(places, options = {}) {
  if (!Array.isArray(places)) return [];
  return places.filter((p) => isAcceptableNearbyPlace(p, options));
}
