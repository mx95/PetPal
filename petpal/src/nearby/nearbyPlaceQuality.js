/**
 * Drop clear Nearby false positives (ordinary cafés tagged as pet cafés)
 * without wiping legitimate pet businesses that lack “pet” in the name.
 * Also hide permanently closed Places results.
 */

const TRUSTED_GOOGLE_TYPES = new Set(['pet_store', 'veterinary_care', 'veterinarian']);

const PET_SIGNAL_RE =
  /\b(pets?|dogs?|cats?|pupp(?:y|ies)|kittens?|animals?|paws?|veterinary|veterinarian|vets?|groom(?:er|ing)?|kennels?|boarding|daycare|doggy|pet[- ]?friendly|pets?\s+allowed|dogs?\s+(?:allowed|welcome|ok|okay)|cats?\s+(?:allowed|welcome|ok|okay)|bring\s+your\s+dog|dog[- ]friendly|cat[- ]friendly|cat\s*cafe|dog\s*cafe|pet\s*cafe|ζώα?|σκύλ(?:ος|οι|άκι)?|γατ(?:α|ες|ί)|κτηνίατρ|κατοικίδι|φιλικό\s+προς\s+(?:κατοικίδια|σκύλους)|ветеринар|собак|кошк|питомц|зоо|с\s+собак)\b/i;

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

/** Types that look like a café / sit-down food spot (not just any bar). */
const CAFE_LIKE_TYPES = new Set(['cafe', 'restaurant', 'bakery', 'food']);

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

function isCafeLikeVenue(place) {
  return placeTypes(place).some((t) => CAFE_LIKE_TYPES.has(t));
}

/** Cafés that welcome pets — explicit pet-café wording or café-like + pet signal. */
export function hasPetCafeSignal(place) {
  const text = placeText(place);
  if (
    /\b((pet|dog|cat)[- ]?(friendly[- ]?)?(caf[eé]|coffee)|cat\s*cafe|dog\s*cafe|pet\s*cafe)\b/i.test(
      text
    )
  ) {
    return true;
  }
  if (/\b(pets?\s+allowed|dogs?\s+(?:allowed|welcome)|cats?\s+(?:allowed|welcome))\b/i.test(text)) {
    return isCafeLikeVenue(place) || /\b(caf[eé]|coffee)\b/i.test(text);
  }
  return /\b(caf[eé]|coffee)\b/i.test(text) && PET_SIGNAL_RE.test(text);
}

/**
 * Google Places Nearby Search includes business_status when known.
 * @param {google.maps.places.PlaceResult} place
 */
export function isPermanentlyClosedPlace(place) {
  return place?.business_status === 'CLOSED_PERMANENTLY';
}

/**
 * Only reject ordinary cafés/restaurants from All-services pet-café noise.
 * Cafe tab: trust Google Places keyword matches for pet-friendly / dogs-allowed
 * cafés (they often lack “pet” in the place name — that used to wipe the map).
 *
 * @param {google.maps.places.PlaceResult & { nearbySourceCategoryIds?: string[] }} place
 * @param {{ selectedCategoryId?: string }} [options]
 */
export function isAcceptableNearbyPlace(place, options = {}) {
  if (!place?.name && !place?.place_id) return false;
  if (isPermanentlyClosedPlace(place)) return false;
  if (hasTrustedPetGoogleType(place)) return true;

  const sources = sourceIds(place);
  const selected = options.selectedCategoryId || 'more';
  const foodDrink = isFoodOrDrinkVenue(place);
  const nonCafeSources = sources.filter((id) => id !== 'pet_cafe');

  // Cafe category: show Google's pet-friendly café keyword hits as returned.
  if (selected === 'pet_cafe') {
    return true;
  }

  const petCafeOnly = sources.includes('pet_cafe') && nonCafeSources.length === 0;

  // All services: drop ordinary cafés that only matched pet_café keywords.
  if (petCafeOnly && foodDrink) {
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
