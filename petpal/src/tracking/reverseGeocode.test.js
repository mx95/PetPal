import { placeGridKey, shortenGeocodeResult } from './reverseGeocode';

describe('placeGridKey', () => {
  it('rounds nearby GPS jitter onto the same cell', () => {
    expect(placeGridKey(34.98468, 33.84502)).toBe(placeGridKey(34.98471, 33.84504));
  });
});

describe('shortenGeocodeResult', () => {
  it('prefers street and town over a long formatted address', () => {
    const label = shortenGeocodeResult({
      formatted_address: 'Unnamed Road, 1234 Example, Cyprus',
      address_components: [
        { long_name: 'Makariou III Avenue', types: ['route'] },
        { long_name: 'Larnaca', types: ['locality'] },
        { long_name: 'Cyprus', types: ['country'] },
      ],
    });
    expect(label).toBe('Makariou III Avenue, Larnaca');
  });
});
