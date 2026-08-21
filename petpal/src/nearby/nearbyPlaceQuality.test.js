import {
  filterAcceptableNearbyPlaces,
  hasPetCafeSignal,
  isAcceptableNearbyPlace,
} from './nearbyPlaceQuality';

describe('nearbyPlaceQuality', () => {
  it('rejects ordinary cafés returned for pet-café search (DaVinci-style false positive)', () => {
    const place = {
      place_id: 'davinci',
      name: 'Limanaki DaVinci Espresso Lounge Cafe Bar',
      vicinity: '1st October, Ayia Napa',
      types: ['cafe', 'bar', 'food', 'point_of_interest', 'establishment'],
      nearbySourceCategoryIds: ['pet_cafe'],
    };
    expect(hasPetCafeSignal(place)).toBe(false);
    expect(isAcceptableNearbyPlace(place, { selectedCategoryId: 'more' })).toBe(false);
    expect(isAcceptableNearbyPlace(place, { selectedCategoryId: 'pet_cafe' })).toBe(false);
  });

  it('keeps real pet cafés', () => {
    const place = {
      place_id: 'paws',
      name: 'Paws & Whiskers Cat Cafe',
      vicinity: 'Nicosia',
      types: ['cafe', 'establishment'],
      nearbySourceCategoryIds: ['pet_cafe'],
    };
    expect(hasPetCafeSignal(place)).toBe(true);
    expect(isAcceptableNearbyPlace(place, { selectedCategoryId: 'more' })).toBe(true);
  });

  it('keeps pet-friendly cafés with explicit wording', () => {
    const place = {
      place_id: 'pf',
      name: 'Harbour Pet Friendly Cafe',
      types: ['cafe'],
      nearbySourceCategoryIds: ['pet_cafe'],
    };
    expect(isAcceptableNearbyPlace(place)).toBe(true);
  });

  it('keeps trusted Google pet types without pet wording in the name', () => {
    expect(
      isAcceptableNearbyPlace({
        name: 'Happy Paws',
        types: ['veterinary_care'],
        nearbySourceCategoryIds: ['veterinary_care'],
      })
    ).toBe(true);
    expect(
      isAcceptableNearbyPlace({
        name: 'Supply Co',
        types: ['pet_store'],
      })
    ).toBe(true);
  });

  it('keeps groomers and hospitals with pet signals', () => {
    expect(
      isAcceptableNearbyPlace({
        name: 'Fluffy Cuts Pet Grooming',
        types: ['point_of_interest'],
        nearbySourceCategoryIds: ['grooming'],
      })
    ).toBe(true);
    expect(
      isAcceptableNearbyPlace({
        name: 'Nicosia Animal Hospital',
        types: ['establishment'],
        nearbySourceCategoryIds: ['hospital'],
      })
    ).toBe(true);
  });

  it('drops keyword hits with no pet signal', () => {
    expect(
      isAcceptableNearbyPlace({
        name: 'City Style Studio',
        types: ['beauty_salon', 'establishment'],
        nearbySourceCategoryIds: ['grooming'],
      })
    ).toBe(false);
    expect(
      isAcceptableNearbyPlace({
        name: 'Fitness Coach Pro',
        types: ['gym'],
        nearbySourceCategoryIds: ['trainer'],
      })
    ).toBe(false);
  });

  it('keeps parks when browsing Parks; requires dog/pet wording in All services', () => {
    const park = {
      name: 'Municipal Park',
      types: ['park'],
      nearbySourceCategoryIds: ['park'],
    };
    expect(isAcceptableNearbyPlace(park, { selectedCategoryId: 'park' })).toBe(true);
    expect(isAcceptableNearbyPlace(park, { selectedCategoryId: 'more' })).toBe(false);
    expect(
      isAcceptableNearbyPlace(
        { ...park, name: 'Ayia Napa Dog Park' },
        { selectedCategoryId: 'more' }
      )
    ).toBe(true);
  });

  it('filters a mixed list down to acceptable places', () => {
    const kept = filterAcceptableNearbyPlaces(
      [
        {
          name: 'Limanaki DaVinci Espresso Lounge Cafe Bar',
          types: ['cafe', 'bar'],
          nearbySourceCategoryIds: ['pet_cafe'],
        },
        {
          name: 'Pet World',
          types: ['pet_store'],
          nearbySourceCategoryIds: ['pet_store'],
        },
        {
          name: 'Beach Bar Central',
          types: ['bar'],
          nearbySourceCategoryIds: ['beach'],
        },
      ],
      { selectedCategoryId: 'more' }
    );
    expect(kept.map((p) => p.name)).toEqual(['Pet World']);
  });
});
