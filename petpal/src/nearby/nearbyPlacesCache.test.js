import {
  clearNearbyPlacesCache,
  getNearbyPlacesCache,
  nearbyPlacesCacheKey,
  roundNearbyCoord,
  setNearbyPlacesCache,
} from './nearbyPlacesCache';

describe('nearbyPlacesCache', () => {
  afterEach(() => {
    clearNearbyPlacesCache();
  });

  test('roundNearbyCoord groups nearby GPS readings', () => {
    expect(roundNearbyCoord(35.173456)).toBe(35.173);
    expect(roundNearbyCoord(35.173456)).toBe(roundNearbyCoord(35.173499));
  });

  test('cache key is stable for radius searches', () => {
    const key = nearbyPlacesCacheKey({
      categoryId: 'veterinary_care',
      scope: 'radius',
      center: { lat: 35.1734, lng: 33.3648 },
    });
    expect(key).toBe('veterinary_care|radius|35.173|33.365');
  });

  test('stores and returns places until TTL expires', () => {
    const key = 'vet|radius|35|33';
    setNearbyPlacesCache(key, [{ place_id: 'abc' }], 50);
    expect(getNearbyPlacesCache(key)).toEqual([{ place_id: 'abc' }]);
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(getNearbyPlacesCache(key)).toBeNull();
        resolve();
      }, 60);
    });
  });
});
