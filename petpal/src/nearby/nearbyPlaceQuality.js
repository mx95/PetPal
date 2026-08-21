/**
 * Drop clear Nearby false positives (ordinary cafés tagged as pet cafés)
 * without wiping legitimate pet businesses that lack “pet” in the name.
 */

const TRUSTED_GOOGLE_TYPES = new Set(['pet_store', 'veterinary_care', 'veterinarian']);

const PET_SIGNAL_RE =
  /\b(pets?|dogs?|cats?|pupp(?:y|ies)|kittens?|animals?|paws?|veterinary|veterinarian|vets?|groom(?:er|ing)?|kennels?|boarding|daycare|doggy|pet[- ]?friendly|cat\s*cafe|dog\s*cafe|pet\s*cafe|ζώα?|σκύλ(?:ος|οι|άκι)?|γατ(?:α|ες|ί)|κτηνίατρ|κατοικίδι|ветеринар|собак|кошк|питомц|зоо)\b/i;

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

/** Real pet cafés — not every place with “cafe” in the name. */
export function hasPetCafeSignal(place) {
  const text = placeText(place);
  if (
    /\b((pet|dog|cat)[- ]?(friendly[- ]?)?(caf[eé]|coffee)|cat\s*cafe|dog\s*cafe|pet\s*cafe)\b/i.test(
      text
    )
  ) {
    return true;
  }
  return /\b(caf[eé]|coffee)\b/i.test(text) && PET_SIGNAL_RE.test(text);
}

/**
 * Only reject ordinary cafés/restaurants from pet-café search.
 * Groomers, hospitals, parks, brand-name clinics, etc. are kept.
 *
 * @param {google.maps.places.PlaceResult & { nearbySourceCategoryIds?: string[] }} place
 * @param {{ selectedCategoryId?: string }} [options]
 */
export function isAcceptableNearbyPlace(place, options = {}) {
  if (!place?.name && !place?.place_id) return false;
  if (hasTrustedPetGoogleType(place)) return true;

  const sources = sourceIds(place);
  const selected = options.selectedCategoryId || 'more';
  const foodDrink = isFoodOrDrinkVenue(place);
  const nonCafeSources = sources.filter((id) => id !== 'pet_cafe');
  const petCafeOnly =
    selected === 'pet_cafe' ||
    (sources.includes('pet_cafe') && nonCafeSources.length === 0);

  // DaVinci-style: Google café/bar returned only for “pet café” keywords.
  if (petCafeOnly && (foodDrink || selected === 'pet_cafe' || sources.includes('pet_cafe'))) {
    return hasPetCafeSignal(place);
  }

  return true;
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
