import {
  filterAcceptableNearbyPlaces,
  hasPetCafeSignal,
  isAcceptableNearbyPlace,
  isPermanentlyClosedPlace,
} from './nearbyPlaceQuality';

describe('nearbyPlaceQuality', () => {
  it('rejects ordinary cafés in All services and on the Pet café tab', () => {
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
    expect(isAcceptableNearbyPlace(place, { selectedCategoryId: 'pet_cafe' })).toBe(true);
  });

  it('keeps pet-friendly cafés with explicit wording', () => {
    const place = {
      place_id: 'pf',
      name: 'Harbour Pet Friendly Cafe',
      types: ['cafe'],
      nearbySourceCategoryIds: ['pet_cafe'],
    };
    expect(isAcceptableNearbyPlace(place)).toBe(true);
    expect(isAcceptableNearbyPlace(place, { selectedCategoryId: 'pet_cafe' })).toBe(true);
  });

  it('keeps café-like venues that mention dogs on the Pet café tab', () => {
    const place = {
      place_id: 'dogs-ok',
      name: 'Garden Terrace',
      vicinity: 'Dogs welcome patio',
      types: ['cafe', 'restaurant'],
      nearbySourceCategoryIds: ['pet_cafe'],
    };
    expect(hasPetCafeSignal(place)).toBe(false);
    expect(isAcceptableNearbyPlace(place, { selectedCategoryId: 'pet_cafe' })).toBe(true);
  });

  it('excludes permanently closed places', () => {
    const place = {
      place_id: 'gone',
      name: 'Old Cat Cafe',
      types: ['cafe'],
      business_status: 'CLOSED_PERMANENTLY',
      nearbySourceCategoryIds: ['pet_cafe'],
    };
    expect(isPermanentlyClosedPlace(place)).toBe(true);
    expect(isAcceptableNearbyPlace(place, { selectedCategoryId: 'pet_cafe' })).toBe(false);
    expect(
      isAcceptableNearbyPlace(
        { name: 'Happy Paws', types: ['veterinary_care'], business_status: 'CLOSED_PERMANENTLY' },
        { selectedCategoryId: 'veterinary_care' }
      )
    ).toBe(false);
  });

  it('keeps operational and temporarily closed places', () => {
    expect(
      isAcceptableNearbyPlace({
        name: 'Paws Cat Cafe',
        types: ['cafe'],
        business_status: 'OPERATIONAL',
        nearbySourceCategoryIds: ['pet_cafe'],
      })
    ).toBe(true);
    expect(
      isAcceptableNearbyPlace({
        name: 'Paws Cat Cafe',
        types: ['cafe'],
        business_status: 'CLOSED_TEMPORARILY',
        nearbySourceCategoryIds: ['pet_cafe'],
      })
    ).toBe(true);
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

  it('keeps groomers, hospitals, trainers, and brand-name hits without dropping them', () => {
    expect(
      isAcceptableNearbyPlace({
        name: 'Fluffy Cuts Pet Grooming',
        types: ['point_of_interest'],
        nearbySourceCategoryIds: ['grooming'],
      })
    ).toBe(true);
    expect(
      isAcceptableNearbyPlace({
        name: 'City Style Studio',
        types: ['beauty_salon', 'establishment'],
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
    expect(
      isAcceptableNearbyPlace({
        name: 'Fitness Coach Pro',
        types: ['gym'],
        nearbySourceCategoryIds: ['trainer'],
      })
    ).toBe(true);
  });

  it('keeps parks from park search in All services', () => {
    const park = {
      name: 'Municipal Park',
      types: ['park'],
      nearbySourceCategoryIds: ['park'],
    };
    expect(isAcceptableNearbyPlace(park, { selectedCategoryId: 'park' })).toBe(true);
    expect(isAcceptableNearbyPlace(park, { selectedCategoryId: 'more' })).toBe(true);
  });

  it('keeps a place that matched grooming even if pet_cafe also matched', () => {
    expect(
      isAcceptableNearbyPlace({
        name: 'Paws Spa',
        types: ['establishment'],
        nearbySourceCategoryIds: ['grooming', 'pet_cafe'],
      })
    ).toBe(true);
  });

  it('filters a mixed list: drop plain café, keep real services', () => {
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
          name: 'Sunshine Grooming',
          types: ['establishment'],
          nearbySourceCategoryIds: ['grooming'],
        },
        {
          name: 'Closed Pet Shop',
          types: ['pet_store'],
          business_status: 'CLOSED_PERMANENTLY',
          nearbySourceCategoryIds: ['pet_store'],
        },
      ],
      { selectedCategoryId: 'more' }
    );
    expect(kept.map((p) => p.name)).toEqual(['Pet World', 'Sunshine Grooming']);
  });
});
