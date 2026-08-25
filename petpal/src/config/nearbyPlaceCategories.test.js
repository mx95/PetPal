import {
  nearbySearchFields,
  NEARBY_CATEGORIES,
  NEARBY_SEARCH_TYPE_WHITELIST,
} from './nearbyPlaceCategories';

describe('nearbySearchFields', () => {
  it('allows Table 1 types used by PetPal', () => {
    expect(nearbySearchFields({ type: 'park', keyword: 'dog' })).toEqual({
      type: 'park',
      keyword: 'dog',
    });
    expect(nearbySearchFields({ type: 'pet_store' })).toEqual({ type: 'pet_store' });
    expect(nearbySearchFields({ type: 'veterinary_care' })).toEqual({ type: 'veterinary_care' });
  });

  it('drops invalid Nearby Search types such as beach', () => {
    expect(nearbySearchFields({ type: 'beach', keyword: 'dog beach' })).toEqual({
      keyword: 'dog beach',
    });
    expect(NEARBY_SEARCH_TYPE_WHITELIST.has('beach')).toBe(false);
  });

  it('falls back to pet keyword when nothing else is set', () => {
    expect(nearbySearchFields({})).toEqual({ keyword: 'pet' });
  });

  it('allows cafe as a Nearby Search type for pet-friendly café search', () => {
    const cafe = NEARBY_CATEGORIES.find((c) => c.id === 'pet_cafe');
    expect(cafe).toBeTruthy();
    expect(NEARBY_SEARCH_TYPE_WHITELIST.has('cafe')).toBe(true);
    expect(nearbySearchFields(cafe)).toEqual({
      type: 'cafe',
      keyword: cafe.keyword,
    });
    expect(cafe.keyword.toLowerCase()).not.toBe('cafe');
  });

  it('configures beach as keyword-only so searches are not INVALID_REQUEST', () => {
    const beach = NEARBY_CATEGORIES.find((c) => c.id === 'beach');
    expect(beach).toBeTruthy();
    expect(beach.type).toBeUndefined();
    expect(nearbySearchFields(beach).type).toBeUndefined();
    expect(nearbySearchFields(beach).keyword).toMatch(/beach/i);
  });
});
