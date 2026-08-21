import { classifyNearbyPlace, nearbyCategoryForPlace } from './classifyNearbyPlace';

describe('classifyNearbyPlace', () => {
  it('uses the selected category when the user filtered to grooming', () => {
    expect(
      classifyNearbyPlace(
        { name: 'City Vet', types: ['veterinary_care'] },
        { fallbackId: 'grooming' }
      )
    ).toBe('grooming');
  });

  it('maps a groomer by name when browsing all pet services', () => {
    expect(
      classifyNearbyPlace(
        { name: 'Fluffy Cuts Pet Grooming', types: ['point_of_interest'] },
        { fallbackId: 'more' }
      )
    ).toBe('grooming');
  });

  it('prefers grooming over pet shop for mixed storefronts', () => {
    expect(
      classifyNearbyPlace({
        name: 'PET SHOP + ACCESSORIES DOGA PET GROOMING + TRAINING',
        types: ['pet_store'],
      })
    ).toBe('grooming');
  });

  it('maps pet hospitals and beaches when browsing all pet services', () => {
    expect(
      classifyNearbyPlace(
        { name: 'Nicosia Animal Hospital', types: ['point_of_interest'] },
        { fallbackId: 'more' }
      )
    ).toBe('hospital');
    expect(
      classifyNearbyPlace(
        { name: 'Lady\'s Mile Dog Beach', types: ['beach'] },
        { fallbackId: 'more' }
      )
    ).toBe('beach');
    expect(classifyNearbyPlace({ name: 'Coast Point', types: ['beach'] })).toBe('beach');
  });

  it('maps pet pharmacies by name when browsing all pet services', () => {
    expect(
      classifyNearbyPlace(
        { name: 'Animal Pharmacy Nicosia', types: ['establishment'] },
        { fallbackId: 'more' }
      )
    ).toBe('pet_pharmacy');
  });

  it('uses Google types when the name is generic', () => {
    expect(classifyNearbyPlace({ name: 'Happy Paws', types: ['veterinary_care'] })).toBe(
      'veterinary_care'
    );
    expect(classifyNearbyPlace({ name: 'Green Acres', types: ['park'] })).toBe('park');
    expect(classifyNearbyPlace({ name: 'Pet World', types: ['pet_store'] })).toBe('pet_store');
  });

  it('uses a single search-source category when types and name are generic', () => {
    expect(
      classifyNearbyPlace({
        name: 'Sunny Spot',
        types: ['establishment'],
        nearbySourceCategoryIds: ['daycare'],
      })
    ).toBe('daycare');
  });

  it('does not treat ordinary cafés as pet cafés', () => {
    expect(
      classifyNearbyPlace(
        {
          name: 'Limanaki DaVinci Espresso Lounge Cafe Bar',
          types: ['cafe', 'bar'],
          nearbySourceCategoryIds: ['pet_cafe'],
        },
        { fallbackId: 'more' }
      )
    ).not.toBe('pet_cafe');
  });

  it('maps pet cafés by explicit pet-café wording', () => {
    expect(
      classifyNearbyPlace(
        { name: 'Whiskers Cat Cafe', types: ['cafe'], nearbySourceCategoryIds: ['pet_cafe'] },
        { fallbackId: 'more' }
      )
    ).toBe('pet_cafe');
  });
});

describe('nearbyCategoryForPlace', () => {
  const t = (key) => key;

  it('returns the scissors category for a groomer', () => {
    const cat = nearbyCategoryForPlace(
      { name: 'Mobile Groomer', types: ['establishment'] },
      'more',
      t
    );
    expect(cat.id).toBe('grooming');
    expect(cat.icon).toBe('✂️');
  });
});
