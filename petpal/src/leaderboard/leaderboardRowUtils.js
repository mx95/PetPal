import { getEffectiveProfilePhotoUrl } from '../profile/userProfilePhoto';
import { displayNameForUser } from './publicWalkFirestore';

/** Only persist remote URLs in Firestore (skip large data: URLs). */
export function photoUrlForLeaderboardSync(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return '';
}

/** @param {{ photoUrl?: string, photoDataUrl?: string } | null | undefined} pet */
export function petPhotoForDisplay(pet) {
  if (!pet) return '';
  return String(pet.photoUrl || pet.photoDataUrl || '').trim();
}

/**
 * Prefer live pet/owner photos for the signed-in user; fall back to stored leaderboard row.
 * @param {Record<string, unknown> | null | undefined} row
 * @param {import('firebase/auth').User | null | undefined} user
 * @param {Array<{ name?: string, photoUrl?: string, photoDataUrl?: string, categoryId?: string }>} pets
 */
export function enrichLeaderboardRow(row, user, pets) {
  if (!row) return null;
  const isYou = Boolean(user?.uid && row.id === user.uid);
  const pet = isYou && pets?.[0] ? pets[0] : null;
  const ownerName = String(row.displayName || (isYou ? displayNameForUser(user) : 'Pet parent')).trim();
  const petName = String(row.petName || pet?.name || '').trim();
  const storedPetPhoto = String(row.petPhotoUrl || '').trim();
  const storedOwnerPhoto = String(row.ownerPhotoUrl || '').trim();
  const livePetPhoto = pet ? petPhotoForDisplay(pet) : '';
  const liveOwnerPhoto = isYou ? getEffectiveProfilePhotoUrl(user) : '';

  return {
    ...row,
    displayName: ownerName,
    petName,
    petPhotoUrl: livePetPhoto || storedPetPhoto,
    ownerPhotoUrl: liveOwnerPhoto || storedOwnerPhoto,
    petCategoryId: String(row.petCategoryId || pet?.categoryId || 'dog'),
  };
}
