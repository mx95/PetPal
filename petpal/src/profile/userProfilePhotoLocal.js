/** @param {string | undefined} uid */
export function profilePhotoLocalStorageKey(uid) {
  return uid ? `petpal_profile_photo_v1_${uid}` : '';
}

export function dispatchProfilePhotoChanged() {
  try {
    window.dispatchEvent(new CustomEvent('petpal-profile-photo-changed'));
  } catch {
    // ignore
  }
}

/**
 * @param {string | undefined} uid
 * @returns {string | null}
 */
export function readLocalProfilePhotoDataUrl(uid) {
  if (!uid) return null;
  try {
    return localStorage.getItem(profilePhotoLocalStorageKey(uid));
  } catch {
    return null;
  }
}

/** @param {string | undefined} uid */
export function clearLocalProfilePhoto(uid) {
  if (!uid) return;
  try {
    localStorage.removeItem(profilePhotoLocalStorageKey(uid));
  } catch {
    // ignore
  }
  dispatchProfilePhotoChanged();
}

/**
 * Device-local override wins (same account can have cloud URL + we still show last local upload if storage failed).
 * @param {import('firebase/auth').User | null | undefined} user
 * @returns {string | null}
 */
export function getEffectiveProfilePhotoUrl(user) {
  if (!user) return null;
  const local = readLocalProfilePhotoDataUrl(user.uid);
  if (local) return local;
  return user.photoURL || null;
}
