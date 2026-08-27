import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { pickPrimaryPhotoUrl, tsToIso } from '../media/photoUploadUtils';
import { getDb, isFirebaseConfigured } from '../firebase';

export const LOST_PET_ALERTS_COL = 'lostPetAlerts';
const FEED_LIMIT = 200;

/**
 * @param {string} id
 * @param {Record<string, unknown>} data
 * @returns {import('./lostPetTypes').LostPetAlert}
 */
export function mapLostPetDoc(id, data) {
  const lat = data.lastSeenLat != null ? Number(data.lastSeenLat) : null;
  const lng = data.lastSeenLng != null ? Number(data.lastSeenLng) : null;
  const photos = Array.isArray(data.photos)
    ? data.photos.map((p) => ({
        url: String(p?.url || p?.photoUrl || ''),
        storagePath: p?.storagePath ? String(p.storagePath) : '',
        isPrimary: !!p?.isPrimary,
      })).filter((p) => p.url)
    : [];
  const primaryPhotoUrl = String(data.primaryPhotoUrl || pickPrimaryPhotoUrl(photos) || data.photoDataUrl || '');
  const status =
    data.status === 'found' || data.status === 'reported' || data.status === 'archived' ? data.status : 'active';
  return {
    id,
    ownerUid: String(data.ownerUid || ''),
    petId: String(data.petId || ''),
    petName: String(data.petName || ''),
    categoryId: String(data.categoryId || 'other'),
    breed: String(data.breed || ''),
    description: String(data.description || ''),
    identifyingMarks: String(data.identifyingMarks || ''),
    lastSeenText: String(data.lastSeenText || ''),
    lastSeenAt: tsToIso(data.lastSeenAt) || tsToIso(data.createdAt),
    lastSeenLat: lat != null && Number.isFinite(lat) ? lat : null,
    lastSeenLng: lng != null && Number.isFinite(lng) ? lng : null,
    reward: String(data.reward || ''),
    contactPhone: String(data.contactPhone || ''),
    additionalInfo: String(data.additionalInfo || ''),
    photos,
    primaryPhotoUrl,
    status,
    reportCount: Number(data.reportCount || 0),
    createdAt: tsToIso(data.createdAt) || new Date().toISOString(),
    updatedAt: tsToIso(data.updatedAt),
    foundAt: tsToIso(data.foundAt),
  };
}

/**
 * @param {string} uid
 * @param {import('./lostPetTypes').LostPetAlertInput} input
 */
export async function createLostPetAlert(uid, input) {
  if (!isFirebaseConfigured() || !uid) return { ok: false, reason: 'no_backend' };
  const photos = Array.isArray(input.photos) ? input.photos : [];
  const payload = {
    ownerUid: uid,
    petId: String(input.petId || '').slice(0, 80),
    petName: String(input.petName || '').trim().slice(0, 120),
    categoryId: String(input.categoryId || 'other').slice(0, 32),
    breed: String(input.breed || '').trim().slice(0, 120),
    description: String(input.description || '').trim().slice(0, 2000),
    identifyingMarks: String(input.identifyingMarks || '').trim().slice(0, 1000),
    lastSeenText: String(input.lastSeenText || '').trim().slice(0, 1000),
    lastSeenAt: input.lastSeenAt ? new Date(input.lastSeenAt) : serverTimestamp(),
    lastSeenLat: input.lastSeenLat != null && Number.isFinite(input.lastSeenLat) ? input.lastSeenLat : null,
    lastSeenLng: input.lastSeenLng != null && Number.isFinite(input.lastSeenLng) ? input.lastSeenLng : null,
    reward: String(input.reward || '').trim().slice(0, 200),
    contactPhone: String(input.contactPhone || '').trim().slice(0, 40),
    additionalInfo: String(input.additionalInfo || '').trim().slice(0, 2000),
    photos,
    primaryPhotoUrl: pickPrimaryPhotoUrl(photos),
    status: 'active',
    reportCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    foundAt: null,
  };
  const ref = await addDoc(collection(getDb(), LOST_PET_ALERTS_COL), payload);
  return { ok: true, id: ref.id };
}

/**
 * @param {string} alertId
 * @param {string} uid
 * @param {Partial<import('./lostPetTypes').LostPetAlertInput>} patch
 */
export async function updateLostPetAlert(alertId, uid, patch) {
  if (!isFirebaseConfigured() || !alertId || !uid) return { ok: false, reason: 'bad_request' };
  const snap = await getDoc(doc(getDb(), LOST_PET_ALERTS_COL, alertId));
  if (!snap.exists() || snap.data()?.ownerUid !== uid) return { ok: false, reason: 'forbidden' };
  const photos = patch.photos ? patch.photos : undefined;
  await updateDoc(doc(getDb(), LOST_PET_ALERTS_COL, alertId), {
    ...(patch.petName != null ? { petName: String(patch.petName).slice(0, 120) } : {}),
    ...(patch.description != null ? { description: String(patch.description).slice(0, 2000) } : {}),
    ...(patch.identifyingMarks != null ? { identifyingMarks: String(patch.identifyingMarks).slice(0, 1000) } : {}),
    ...(patch.lastSeenText != null ? { lastSeenText: String(patch.lastSeenText).slice(0, 1000) } : {}),
    ...(patch.lastSeenAt != null ? { lastSeenAt: patch.lastSeenAt ? new Date(patch.lastSeenAt) : null } : {}),
    ...(patch.lastSeenLat != null ? { lastSeenLat: patch.lastSeenLat } : {}),
    ...(patch.lastSeenLng != null ? { lastSeenLng: patch.lastSeenLng } : {}),
    ...(patch.reward != null ? { reward: String(patch.reward).slice(0, 200) } : {}),
    ...(patch.contactPhone != null ? { contactPhone: String(patch.contactPhone).slice(0, 40) } : {}),
    ...(patch.additionalInfo != null ? { additionalInfo: String(patch.additionalInfo).slice(0, 2000) } : {}),
    ...(photos ? { photos, primaryPhotoUrl: pickPrimaryPhotoUrl(photos) } : {}),
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

export async function markLostPetFound(alertId, uid) {
  if (!isFirebaseConfigured() || !alertId || !uid) return { ok: false, reason: 'bad_request' };
  const ref = doc(getDb(), LOST_PET_ALERTS_COL, alertId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data()?.ownerUid !== uid) return { ok: false, reason: 'forbidden' };
  await updateDoc(ref, { status: 'found', foundAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return { ok: true };
}

export async function reportLostPetAlert(alertId, uid) {
  if (!isFirebaseConfigured() || !alertId || !uid) return { ok: false, reason: 'bad_request' };
  const ref = doc(getDb(), LOST_PET_ALERTS_COL, alertId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, reason: 'missing' };
  if (snap.data()?.ownerUid === uid) return { ok: false, reason: 'own_listing' };
  const nextCount = Number(snap.data()?.reportCount || 0) + 1;
  await updateDoc(ref, {
    status: 'reported',
    reportCount: nextCount,
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

export async function adminSetLostPetStatus(alertId, status) {
  if (!isFirebaseConfigured() || !alertId) return { ok: false, reason: 'bad_request' };
  await updateDoc(doc(getDb(), LOST_PET_ALERTS_COL, alertId), {
    status,
    updatedAt: serverTimestamp(),
    ...(status === 'found' ? { foundAt: serverTimestamp() } : {}),
  });
  return { ok: true };
}

/**
 * @param {(rows: import('./lostPetTypes').LostPetAlert[], err: Error | null) => void} onNext
 */
export function subscribeActiveLostPetAlerts(onNext) {
  if (!isFirebaseConfigured()) {
    onNext([], null);
    return () => {};
  }
  const q = query(
    collection(getDb(), LOST_PET_ALERTS_COL),
    where('status', 'in', ['active', 'reported']),
    orderBy('createdAt', 'desc'),
    limit(FEED_LIMIT)
  );
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map((d) => mapLostPetDoc(d.id, d.data())), null),
    (err) => onNext([], err instanceof Error ? err : new Error(String(err)))
  );
}

/**
 * @param {string} uid
 * @param {(rows: import('./lostPetTypes').LostPetAlert[], err: Error | null) => void} onNext
 */
export function subscribeMyLostPetAlerts(uid, onNext) {
  if (!isFirebaseConfigured() || !uid) {
    onNext([], null);
    return () => {};
  }
  const q = query(
    collection(getDb(), LOST_PET_ALERTS_COL),
    where('ownerUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(FEED_LIMIT)
  );
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map((d) => mapLostPetDoc(d.id, d.data())), null),
    (err) => onNext([], err instanceof Error ? err : new Error(String(err)))
  );
}

export async function fetchLostPetAlertById(alertId) {
  if (!isFirebaseConfigured() || !alertId) return null;
  const snap = await getDoc(doc(getDb(), LOST_PET_ALERTS_COL, alertId));
  if (!snap.exists()) return null;
  return mapLostPetDoc(snap.id, snap.data());
}

/**
 * Migrate legacy localStorage alerts into Firestore once per user.
 * @param {string} uid
 * @param {import('./lostPetTypes').LostPetAlert[]} legacyRows
 */
export async function migrateLegacyLostPetAlerts(uid, legacyRows) {
  if (!isFirebaseConfigured() || !uid || !legacyRows?.length) return { migrated: 0 };
  let migrated = 0;
  for (const row of legacyRows) {
    if (!row?.active) continue;
    const photos = row.photoDataUrl ? [{ url: row.photoDataUrl, isPrimary: true }] : [];
    const r = await createLostPetAlert(uid, {
      petId: row.petId,
      petName: row.petName,
      categoryId: row.categoryId,
      description: row.description,
      lastSeenText: row.lastSeenText,
      lastSeenLat: row.lastSeenLat,
      lastSeenLng: row.lastSeenLng,
      reward: row.reward,
      contactPhone: row.contactPhone,
      photos,
    });
    if (r.ok) migrated += 1;
  }
  return { migrated };
}
