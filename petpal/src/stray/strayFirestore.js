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
export const STRAY_LISTINGS_COL = 'strayListings';

const LIST_LIMIT = 150;

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
 * @param {Record<string, unknown>} data
 * @param {string} id
 * @returns {import('./strayTypes').StrayListing}
 */
export function mapStrayDoc(id, data) {
  const lat = data.foundLat != null ? Number(data.foundLat) : null;
  const lng = data.foundLng != null ? Number(data.foundLng) : null;
  return {
    id,
    reporterUid: String(data.reporterUid || ''),
    categoryId: String(data.categoryId || 'other'),
    nickname: String(data.nickname || ''),
    description: String(data.description || ''),
    foundWhere: String(data.foundWhere || ''),
    foundWhenNote: data.foundWhenNote != null ? String(data.foundWhenNote) : '',
    contactPhone: String(data.contactPhone || ''),
    contactEmail: data.contactEmail != null ? String(data.contactEmail) : '',
    photoDataUrl: data.photoDataUrl != null ? String(data.photoDataUrl) : '',
    foundLat: lat != null && Number.isFinite(lat) ? lat : null,
    foundLng: lng != null && Number.isFinite(lng) ? lng : null,
    status: data.status === 'adopted' || data.status === 'withdrawn' ? data.status : 'available',
    createdAt: tsToIso(data.createdAt) || new Date().toISOString(),
    updatedAt: tsToIso(data.updatedAt),
  };
}

/**
 * @param {object} params
 * @param {string} params.uid
 * @param {string} params.categoryId
 * @param {string} params.nickname
 * @param {string} params.description
 * @param {string} params.foundWhere
 * @param {string} [params.foundWhenNote]
 * @param {string} params.contactPhone
 * @param {string} [params.contactEmail]
 * @param {string} [params.photoDataUrl]
 * @param {number|null} [params.foundLat]
 * @param {number|null} [params.foundLng]
 */
export async function createStrayListing(params) {
  if (!isFirebaseConfigured()) return { ok: false, reason: 'no_backend' };
  const uid = params.uid;
  if (!uid) return { ok: false, reason: 'no_auth' };

  const nickname = String(params.nickname || '').trim().slice(0, 120);
  const description = String(params.description || '').trim().slice(0, 2000);
  const foundWhere = String(params.foundWhere || '').trim().slice(0, 500);
  const contactPhone = String(params.contactPhone || '').trim().slice(0, 40);
  const contactEmail = String(params.contactEmail || '').trim().slice(0, 120);
  const foundWhenNote = String(params.foundWhenNote || '').trim().slice(0, 300);
  let photoDataUrl =
    typeof params.photoDataUrl === 'string' && params.photoDataUrl.startsWith('data:image/')
      ? params.photoDataUrl
      : '';
  if (photoDataUrl.length > 380000) {
    return { ok: false, reason: 'photo_too_large' };
  }

  if (!description || !foundWhere || !contactPhone) {
    return { ok: false, reason: 'required' };
  }

  let foundLat =
    params.foundLat != null && String(params.foundLat).trim() !== '' ? Number(params.foundLat) : null;
  let foundLng =
    params.foundLng != null && String(params.foundLng).trim() !== '' ? Number(params.foundLng) : null;
  if (foundLat != null && !Number.isFinite(foundLat)) foundLat = null;
  if (foundLng != null && !Number.isFinite(foundLng)) foundLng = null;

  const db = getDb();
  await addDoc(collection(db, STRAY_LISTINGS_COL), {
    reporterUid: uid,
    categoryId: String(params.categoryId || 'other').slice(0, 32),
    nickname,
    description,
    foundWhere,
    ...(foundWhenNote ? { foundWhenNote } : {}),
    contactPhone,
    ...(contactEmail ? { contactEmail } : {}),
    ...(photoDataUrl ? { photoDataUrl } : {}),
    foundLat,
    foundLng,
    status: 'available',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

/**
 * @param {'adopted'|'withdrawn'} status
 */
export async function setStrayListingStatus(listingId, uid, status) {
  if (!isFirebaseConfigured() || !listingId || !uid) return { ok: false, reason: 'bad_request' };
  const db = getDb();
  await updateDoc(doc(db, STRAY_LISTINGS_COL, listingId), {
    status,
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

/**
 * Live updates for recent stray listings (all statuses; filter in UI).
 * @param {(rows: import('./strayTypes').StrayListing[], err: Error | null) => void} onNext
 * @returns {() => void}
 */
export function subscribeStrayListings(onNext) {
  if (!isFirebaseConfigured()) {
    onNext([], null);
    return () => {};
  }
  const db = getDb();
  const q = query(collection(db, STRAY_LISTINGS_COL), orderBy('createdAt', 'desc'), limit(LIST_LIMIT));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => mapStrayDoc(d.id, d.data()));
      onNext(rows, null);
    },
    (err) => {
      onNext([], err instanceof Error ? err : new Error(String(err)));
    }
  );
}
