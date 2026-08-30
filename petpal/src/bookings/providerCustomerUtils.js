export function isWalkInCustomerUid(uid) {
  return String(uid || '').startsWith('walkin:');
}

/**
 * @param {Array<Record<string, unknown>>} bookings
 * @param {(key: string, vars?: Record<string, unknown>) => string} t
 */
export function aggregateCustomersFromBookings(bookings, t) {
  const map = new Map();

  bookings.forEach((b) => {
    const customerUid = String(b.customerUid || '');
    const isWalkIn = b.walkIn === true || isWalkInCustomerUid(customerUid);
    const petSnap = b.petSnapshot && typeof b.petSnapshot === 'object' ? b.petSnapshot : {};
    const custSnap = b.customerSnapshot && typeof b.customerSnapshot === 'object' ? b.customerSnapshot : {};

    const key = isWalkIn
      ? `walkin:${String(petSnap.ownerPhone || '')}:${String(petSnap.ownerName || '')}:${String(petSnap.name || b.id)}`
      : customerUid || String(b.id);

    const when = b.startAt?.toDate ? b.startAt.toDate().toISOString() : '';

    const existing = map.get(key);
    const preferLatest = !existing || (when && when >= String(existing.lastVisit || ''));

    const row = existing || {
      key,
      customerUid: isWalkIn ? '' : customerUid,
      isWalkIn,
      customerName: '',
      customerEmail: '',
      customerPhotoUrl: '',
      petName: t('providerPortal.petFallback'),
      petPhotoUrl: '',
      petCategoryId: 'dog',
      petId: '',
      visits: 0,
      lastVisit: '',
    };

    row.visits += 1;
    if (when && when >= row.lastVisit) {
      row.lastVisit = when;
      if (b.petId) row.petId = String(b.petId);
      if (petSnap.name) row.petName = String(petSnap.name);
      if (petSnap.categoryId) row.petCategoryId = String(petSnap.categoryId);
      if (petSnap.photoUrl) row.petPhotoUrl = String(petSnap.photoUrl);
      else if (petSnap.photoDataUrl) row.petPhotoUrl = String(petSnap.photoDataUrl);
    }

    if (custSnap.displayName) row.customerName = String(custSnap.displayName);
    else if (petSnap.ownerName && (!row.customerName || preferLatest)) row.customerName = String(petSnap.ownerName);

    if (custSnap.email) row.customerEmail = String(custSnap.email);
    if (custSnap.photoURL) row.customerPhotoUrl = String(custSnap.photoURL);
    else if (custSnap.profilePhotoUrl) row.customerPhotoUrl = String(custSnap.profilePhotoUrl);

    if (!row.customerName && !isWalkIn && customerUid) {
      row.customerName = t('providerPortal.customerLabelWithId', { id: customerUid.slice(0, 8) });
    }
    if (isWalkIn && petSnap.ownerName) row.customerName = String(petSnap.ownerName);
    if (isWalkIn && !row.customerName) row.customerName = t('providerPortal.walkInCustomer');

    map.set(key, row);
  });

  return [...map.values()].sort((a, b) => String(b.lastVisit).localeCompare(String(a.lastVisit)));
}
