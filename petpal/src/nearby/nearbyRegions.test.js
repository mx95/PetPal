import { nearbyRegionsForPoint, nearbyRegionsForSearch } from './nearbyRegions';
import { distanceKm, placeInsideBounds, placeLatLng, placeWithinRadiusKm, toMapPlace } from './placeMapUtils';

describe('nearbyRegions', () => {
  test('Nicosia is in Cyprus', () => {
    expect(nearbyRegionsForPoint(35.17, 33.36)).toEqual(['CY']);
  });

  test('Athens is in Greece', () => {
    expect(nearbyRegionsForPoint(37.98, 23.73)).toEqual(['GR']);
  });

  test('defaults to Cyprus outside both regions', () => {
    expect(nearbyRegionsForSearch(51.5, -0.12)).toEqual(['CY']);
  });
});

describe('placeMapUtils', () => {
  test('toMapPlace builds geometry from lat/lng rows', () => {
    const row = { place_id: 'abc', name: 'Test', lat: 35.1, lng: 33.2 };
    const mapped = toMapPlace(row, 'pet_store');
    expect(mapped.geometry.location).toEqual({ lat: 35.1, lng: 33.2 });
    expect(mapped.nearbySourceCategoryIds).toEqual(['pet_store']);
  });

  test('distanceKm works for serialized places', () => {
    const km = distanceKm({ lat: 35.17, lng: 33.36 }, { lat: 35.18, lng: 33.37 });
    expect(km).not.toBeNull();
    expect(km).toBeLessThan(2);
  });

  test('placeWithinRadiusKm filters by search radius', () => {
    const center = { lat: 35.17, lng: 33.36 };
    expect(placeWithinRadiusKm({ lat: 35.171, lng: 33.361 }, center, 5)).toBe(true);
    expect(placeWithinRadiusKm({ lat: 36.5, lng: 33.36 }, center, 5)).toBe(false);
  });

  test('placeInsideBounds respects map bounds', () => {
    const bounds = {
      getNorthEast: () => ({ lat: () => 35.2, lng: () => 33.4 }),
      getSouthWest: () => ({ lat: () => 35.1, lng: () => 33.3 }),
    };
    expect(placeInsideBounds({ lat: 35.15, lng: 33.35 }, bounds)).toBe(true);
    expect(placeInsideBounds({ lat: 34.9, lng: 33.35 }, bounds)).toBe(false);
  });

  test('placeLatLng reads geometry.location', () => {
    expect(placeLatLng({ geometry: { location: { lat: 1, lng: 2 } } })).toEqual({ lat: 1, lng: 2 });
  });
});
