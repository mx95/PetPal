/**
 * Nearby false-positive filter (Cloud Functions copy).
 * Keep in sync with petpal/src/nearby/nearbyPlaceQuality.js
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

function hasPetCafeSignal(place) {
  const text = placeText(place);
  if (
    /\b((pet|dog|cat)[- ]?(friendly[- ]?)?(caf[eé]|coffee)|cat\s*cafe|dog\s*cafe|pet\s*cafe)\b/i.test(
      text
    )
  ) {
    return true;
  }
  if (/\b(pets?\s+allowed|dogs?\s+(?:allowed|welcome)|cats?\s+(?:allowed|welcome))\b/i.test(text)) {
    return (
      placeTypes(place).some((t) => CAFE_LIKE_TYPES.has(t)) || /\b(caf[eé]|coffee)\b/i.test(text)
    );
  }
  return /\b(caf[eé]|coffee)\b/i.test(text) && PET_SIGNAL_RE.test(text);
}

function isPermanentlyClosedPlace(place) {
  return place?.business_status === 'CLOSED_PERMANENTLY';
}

function isAcceptableNearbyPlace(place, options = {}) {
  if (!place?.name && !place?.place_id) return false;
  if (isPermanentlyClosedPlace(place)) return false;
  if (placeTypes(place).some((t) => TRUSTED_GOOGLE_TYPES.has(t))) return true;

  const sources = sourceIds(place);
  const selected = options.selectedCategoryId || 'more';
  const foodDrink = placeTypes(place).some((t) => FOOD_DRINK_TYPES.has(t));
  const nonCafeSources = sources.filter((id) => id !== 'pet_cafe');

  if (selected === 'pet_cafe') return true;

  const petCafeOnly = sources.includes('pet_cafe') && nonCafeSources.length === 0;
  if (petCafeOnly && foodDrink) return hasPetCafeSignal(place);

  return true;
}

function filterAcceptableNearbyPlaces(places, options = {}) {
  if (!Array.isArray(places)) return [];
  return places.filter((p) => isAcceptableNearbyPlace(p, options));
}

module.exports = {
  filterAcceptableNearbyPlaces,
};
