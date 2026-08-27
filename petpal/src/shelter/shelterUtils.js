/** @typedef {'pending'|'approved'|'rejected'|'suspended'} ShelterStatus */

/**
 * @param {ShelterStatus | string | undefined} status
 */
export function isPublicShelterStatus(status) {
  return status === 'approved';
}

/**
 * @param {import('./shelterTypes').ShelterProfile | null | undefined} profile
 * @param {string | null | undefined} uid
 */
export function canManageShelter(profile, uid) {
  return Boolean(profile && uid && profile.ownerUid === uid && profile.status === 'approved');
}

/**
 * @param {Partial<import('./shelterTypes').ShelterProfile>} input
 */
export function validateShelterApplication(input) {
  if (!String(input.shelterName || '').trim()) return { ok: false, code: 'name' };
  if (!String(input.contactPerson || '').trim()) return { ok: false, code: 'contact' };
  if (!String(input.phoneNumber || '').trim()) return { ok: false, code: 'phone' };
  if (!String(input.publicEmail || '').trim()) return { ok: false, code: 'email' };
  if (input.lat == null || input.lng == null || Number.isNaN(Number(input.lat)) || Number.isNaN(Number(input.lng))) {
    return { ok: false, code: 'location' };
  }
  return { ok: true };
}

/**
 * @param {import('./shelterTypes').ShelterAnimal | null | undefined} animal
 */
export function isPublicShelterAnimal(animal) {
  return Boolean(animal && (animal.adoptionStatus === 'available' || animal.adoptionStatus === 'foster'));
}

export const CYPRUS_CITIES = ['Nicosia', 'Larnaca', 'Limassol', 'Paphos', 'Famagusta'];
