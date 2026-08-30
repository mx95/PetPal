/**
 * Snapshots customer + pet fields onto booking docs so providers can render
 * contact cards without reading other users' private profile data at view time.
 */

/**
 * @param {import('firebase/auth').User | null | undefined} user
 */
export function buildCustomerSnapshot(user) {
  if (!user) return {};
  const email = String(user.email || '').trim();
  const displayName = String(user.displayName || '').trim();
  const photoURL = String(user.photoURL || '').trim();
  return {
    ...(email ? { email } : {}),
    ...(displayName ? { displayName } : {}),
    ...(photoURL ? { photoURL } : {}),
  };
}

/**
 * @param {{ name?: string, categoryId?: string, photoUrl?: string, photoDataUrl?: string, ownerName?: string, ownerPhone?: string } | null | undefined} pet
 * @param {import('firebase/auth').User | null | undefined} user
 */
export function buildPetSnapshotForBooking(pet, user) {
  const name = String(pet?.name || '').trim();
  const ownerName = String(user?.displayName || pet?.ownerName || '').trim();
  const ownerPhone = String(pet?.ownerPhone || '').trim();
  const photoUrl = String(pet?.photoUrl || '').trim();
  const photoDataUrl =
    typeof pet?.photoDataUrl === 'string' && pet.photoDataUrl.startsWith('data:') ? pet.photoDataUrl : '';

  return {
    ...(name ? { name } : {}),
    categoryId: pet?.categoryId || 'dog',
    ...(photoUrl ? { photoUrl } : {}),
    ...(photoDataUrl ? { photoDataUrl } : {}),
    ...(ownerName ? { ownerName } : {}),
    ...(ownerPhone ? { ownerPhone } : {}),
  };
}
