function str(v) {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

export function bookingPetName(b) {
  return str(b?.petSnapshot?.name) || str(b?.petName);
}

export function bookingCustomerName(b) {
  return str(b?.petSnapshot?.ownerName) || str(b?.customerName) || str(b?.customer?.name);
}

export function bookingCustomerPhone(b) {
  return str(b?.petSnapshot?.ownerPhone) || str(b?.customerPhone) || str(b?.customer?.phone);
}

export function bookingServiceName(b) {
  return str(b?.serviceSnapshot?.name) || str(b?.serviceName);
}

export function bookingProviderName(b) {
  return str(b?.providerName) || str(b?.storeName) || str(b?.companyName);
}

export function isWalkInBooking(b) {
  return Boolean(b?.walkIn) || String(b?.customerUid || '').startsWith('walkin:');
}

export function bookingSearchHaystack(b) {
  return [
    b?.id,
    b?.customerUid,
    b?.companyId,
    b?.slotId,
    b?.serviceId,
    b?.petId,
    bookingPetName(b),
    bookingCustomerName(b),
    bookingCustomerPhone(b),
    bookingServiceName(b),
    bookingProviderName(b),
    b?.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
