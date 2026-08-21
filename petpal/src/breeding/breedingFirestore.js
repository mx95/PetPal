import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
export const BREEDING_LISTINGS_COL = 'breedingListings';

const LIST_LIMIT = 200;

/** @param {unknown} v */
function tsToIso(v) {
  if (!v) return '';
  try {
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
  } catch {
    // ignore
  }
  return '';
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} data
 * @returns {import('./breedingTypes').BreedingListing}
 */
export function mapBreedingDoc(id, data) {
  return {
    id,
    ownerUid: String(data.ownerUid || ''),
    dogName: String(data.dogName || ''),
    breedLabel: String(data.breedLabel || ''),
    gender: data.gender === 'female' ? 'female' : 'male',
    description: String(data.description || ''),
    locationText: String(data.locationText || ''),
    linkedPetId: data.linkedPetId != null ? String(data.linkedPetId) : '',
    contactPhone: String(data.contactPhone || ''),
    contactEmail: data.contactEmail != null ? String(data.contactEmail) : '',
    photoDataUrl: data.photoDataUrl != null ? String(data.photoDataUrl) : '',
    status: data.status === 'paused' || data.status === 'matched' ? data.status : 'active',
    createdAt: tsToIso(data.createdAt) || new Date().toISOString(),
    updatedAt: tsToIso(data.updatedAt),
  };
}

/**
 * @param {object} params
 * @param {string} params.uid
 * @param {string} params.dogName
 * @param {string} params.breedLabel
 * @param {'male'|'female'} params.gender
 * @param {string} params.description
 * @param {string} params.locationText
 * @param {string} params.contactPhone
 * @param {string} [params.contactEmail]
 * @param {string} [params.linkedPetId]
 * @param {string} [params.photoDataUrl]
 */
export async function createBreedingListing(params) {
  if (!isFirebaseConfigured()) return { ok: false, reason: 'no_backend' };
  const uid = params.uid;
  if (!uid) return { ok: false, reason: 'no_auth' };

  const dogName = String(params.dogName || '').trim().slice(0, 80);
  const breedLabel = String(params.breedLabel || '').trim().slice(0, 120);
  const description = String(params.description || '').trim().slice(0, 2500);
  const locationText = String(params.locationText || '').trim().slice(0, 300);
  const contactPhone = String(params.contactPhone || '').trim().slice(0, 40);
  const contactEmail = String(params.contactEmail || '').trim().slice(0, 120);
  let photoDataUrl =
    typeof params.photoDataUrl === 'string' && params.photoDataUrl.startsWith('data:image/')
      ? params.photoDataUrl
      : '';
  if (photoDataUrl.length > 380000) {
    return { ok: false, reason: 'photo_too_large' };
  }

  if (!dogName || !breedLabel || !description || !contactPhone || !locationText) {
    return { ok: false, reason: 'required' };
  }

  const gender = params.gender === 'female' ? 'female' : 'male';
  const linkedPetId = String(params.linkedPetId || '').trim().slice(0, 120);

  const db = getDb();
  await addDoc(collection(db, BREEDING_LISTINGS_COL), {
    ownerUid: uid,
    dogName,
    breedLabel,
    gender,
    description,
    locationText,
    contactPhone,
    ...(contactEmail ? { contactEmail } : {}),
    ...(linkedPetId ? { linkedPetId } : {}),
    ...(photoDataUrl ? { photoDataUrl } : {}),
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

/**
 * @param {'paused'|'matched'} status
 */
export async function setBreedingListingStatus(listingId, uid, status) {
  if (!isFirebaseConfigured() || !listingId || !uid) return { ok: false, reason: 'bad_request' };
  await updateDoc(doc(getDb(), BREEDING_LISTINGS_COL, listingId), {
    status,
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

/**
 * @param {(rows: import('./breedingTypes').BreedingListing[], err: Error | null) => void} onNext
 */
export function subscribeBreedingListings(onNext) {
  if (!isFirebaseConfigured()) {
    onNext([], null);
    return () => {};
  }
  const db = getDb();
  const q = query(collection(db, BREEDING_LISTINGS_COL), orderBy('createdAt', 'desc'), limit(LIST_LIMIT));
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((d) => mapBreedingDoc(d.id, d.data())), null);
    },
    (err) => {
      onNext([], err instanceof Error ? err : new Error(String(err)));
    }
  );
}
