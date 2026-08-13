import {
  bookingCustomerName,
  bookingPetName,
  bookingProviderName,
  bookingSearchHaystack,
  bookingServiceName,
  isWalkInBooking,
} from './adminBookingRow';

const booking = {
  id: 'Iu9zhpRjGYB',
  customerUid: 'eVTrL2abc',
  companyId: 'co_1',
  status: 'booked',
  providerName: 'Fluffy Cuts',
  petSnapshot: { name: 'Odin', ownerName: 'Sotiris Kapnoullas', ownerPhone: '+35799111222' },
  serviceSnapshot: { name: 'Full grooming' },
};

describe('adminBookingRow', () => {
  it('reads pet, customer, service, and provider from snapshots', () => {
    expect(bookingPetName(booking)).toBe('Odin');
    expect(bookingCustomerName(booking)).toBe('Sotiris Kapnoullas');
    expect(bookingServiceName(booking)).toBe('Full grooming');
    expect(bookingProviderName(booking)).toBe('Fluffy Cuts');
    expect(isWalkInBooking(booking)).toBe(false);
  });

  it('detects walk-in bookings and matches search text', () => {
    expect(isWalkInBooking({ customerUid: 'walkin:co:1', walkIn: false })).toBe(true);
    expect(bookingSearchHaystack(booking)).toContain('odin');
    expect(bookingSearchHaystack(booking)).toContain('sotiris kapnoullas');
    expect(bookingSearchHaystack(booking)).toContain('fluffy cuts');
  });
});
