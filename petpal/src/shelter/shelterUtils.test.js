import { isPublicShelterStatus, validateShelterApplication } from './shelterUtils';

describe('shelterUtils', () => {
  it('validates shelter application required fields', () => {
    expect(validateShelterApplication({ shelterName: 'ABC' })).toEqual({ ok: false, code: 'contact' });
    expect(
      validateShelterApplication({
        shelterName: 'ABC',
        contactPerson: 'Jane',
        phoneNumber: '99',
        publicEmail: 'a@b.com',
        lat: 35.1,
        lng: 33.3,
      })
    ).toEqual({ ok: true });
  });

  it('checks public shelter status', () => {
    expect(isPublicShelterStatus('approved')).toBe(true);
    expect(isPublicShelterStatus('pending')).toBe(false);
  });
});
