import {
  isHiddenDemoProvider,
  pickDefaultServiceForTab,
  providerMatchesServiceTab,
} from './bookingBrowseUtils';

describe('providerMatchesServiceTab', () => {
  test('matches walker providers', () => {
    expect(providerMatchesServiceTab({ providerTypes: { walker: true } }, 'walker')).toBe(true);
    expect(providerMatchesServiceTab({ providerTypes: { vet: true } }, 'walker')).toBe(false);
  });
});

describe('pickDefaultServiceForTab', () => {
  test('picks walker services for walker tab', () => {
    const services = [
      { id: '1', type: 'vet', name: 'Checkup', active: true },
      { id: '2', type: 'walker', name: '30 min walk', active: true },
    ];
    expect(pickDefaultServiceForTab(services, 'walker')?.id).toBe('2');
  });
});

describe('isHiddenDemoProvider', () => {
  test('hides seeded PetPal Demo Grooming and Sotiris Demo', () => {
    expect(isHiddenDemoProvider({ displayName: 'PetPal Demo Grooming' })).toBe(true);
    expect(isHiddenDemoProvider({ displayName: 'Sotiris Demo' })).toBe(true);
    expect(
      isHiddenDemoProvider({
        displayName: 'Real Groomer',
        address: 'Artemidos 4, Xylofagou',
      })
    ).toBe(true);
    expect(isHiddenDemoProvider({ displayName: 'Cyprus Pet Care', address: 'Limassol' })).toBe(false);
  });
});
