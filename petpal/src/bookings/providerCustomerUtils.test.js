import { aggregateCustomersFromBookings, isWalkInCustomerUid } from './providerCustomerUtils';

const t = (key, vars) => {
  if (key === 'providerPortal.petFallback') return 'Pet';
  if (key === 'providerPortal.walkInCustomer') return 'Walk-in customer';
  if (key === 'providerPortal.customerLabelWithId') return `Customer ${vars.id}…`;
  return key;
};

describe('providerCustomerUtils', () => {
  it('detects walk-in customer uids', () => {
    expect(isWalkInCustomerUid('walkin:co1:pet1')).toBe(true);
    expect(isWalkInCustomerUid('abc123')).toBe(false);
  });

  it('groups bookings by customer and keeps latest pet visit', () => {
    const rows = aggregateCustomersFromBookings(
      [
        {
          id: 'b1',
          customerUid: 'u1',
          petId: 'p1',
          customerSnapshot: { email: 'ada@example.com', displayName: 'Ada', photoURL: 'https://x/ada.jpg' },
          petSnapshot: { name: 'Luna', categoryId: 'dog', photoUrl: 'https://x/luna.jpg' },
          startAt: { toDate: () => new Date('2026-08-10T10:00:00Z') },
        },
        {
          id: 'b2',
          customerUid: 'u1',
          petId: 'p2',
          customerSnapshot: { email: 'ada@example.com', displayName: 'Ada', photoURL: 'https://x/ada.jpg' },
          petSnapshot: { name: 'Milo', categoryId: 'cat', photoUrl: 'https://x/milo.jpg' },
          startAt: { toDate: () => new Date('2026-08-17T10:00:00Z') },
        },
      ],
      t
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].customerEmail).toBe('ada@example.com');
    expect(rows[0].customerName).toBe('Ada');
    expect(rows[0].petName).toBe('Milo');
    expect(rows[0].petId).toBe('p2');
    expect(rows[0].visits).toBe(2);
  });

  it('handles walk-in owner name and pet', () => {
    const rows = aggregateCustomersFromBookings(
      [
        {
          id: 'w1',
          customerUid: 'walkin:co:abc',
          walkIn: true,
          petSnapshot: { name: 'Odin', ownerName: 'Jack', ownerPhone: '+35799111222' },
          startAt: { toDate: () => new Date('2026-08-17T09:40:00Z') },
        },
      ],
      t
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].customerName).toBe('Jack');
    expect(rows[0].petName).toBe('Odin');
    expect(rows[0].isWalkIn).toBe(true);
    expect(rows[0].customerEmail).toBe('');
  });
});
