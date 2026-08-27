/** @typedef {'active'|'found'|'reported'|'archived'} LostPetStatus */

/**
 * @param {LostPetStatus | string | undefined} status
 */
export function isActiveLostPetStatus(status) {
  return status === 'active' || status === 'reported';
}

/**
 * @param {import('./lostPetTypes').LostPetAlert | null | undefined} alert
 * @param {string | null | undefined} uid
 */
export function canEditLostPetAlert(alert, uid) {
  return Boolean(alert && uid && alert.ownerUid === uid && alert.status !== 'archived');
}

/**
 * @param {import('./lostPetTypes').LostPetAlert | null | undefined} alert
 * @param {string | null | undefined} uid
 */
export function canMarkLostPetFound(alert, uid) {
  return canEditLostPetAlert(alert, uid) && alert?.status !== 'found';
}

/**
 * @param {import('./lostPetTypes').LostPetAlertInput} input
 */
export function validateLostPetInput(input) {
  if (!String(input.petId || '').trim()) return { ok: false, code: 'pet' };
  if (!String(input.description || '').trim()) return { ok: false, code: 'description' };
  if (!String(input.lastSeenText || '').trim()) return { ok: false, code: 'lastSeen' };
  if (!String(input.contactPhone || '').trim()) return { ok: false, code: 'phone' };
  return { ok: true };
}

/**
 * @param {Array<{ status?: string }>} rows
 */
export function filterActiveLostPetFeed(rows) {
  return (rows || []).filter((r) => isActiveLostPetStatus(r.status));
}

/**
 * @param {string} categoryId
 * @param {(key: string) => string} t
 */
export function lostPetSpeciesLabel(categoryId, t) {
  const id = String(categoryId || 'other');
  const key = `pets.categories.${id}`;
  const label = t(key);
  return label === key ? id : label;
}
