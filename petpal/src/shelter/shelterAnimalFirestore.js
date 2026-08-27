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

export const SHELTER_ANIMALS_COL = 'shelterAnimals';

/**
 * @param {string} id
 * @param {Record<string, unknown>} data
 * @returns {import('./shelterTypes').ShelterAnimal}
 */
export function mapShelterAnimalDoc(id, data) {
  const photos = Array.isArray(data.photos)
    ? data.photos
        .map((p) => ({
          url: String(p?.url || p?.photoUrl || ''),
          storagePath: p?.storagePath ? String(p.storagePath) : '',
          isPrimary: !!p?.isPrimary,
        }))
        .filter((p) => p.url)
    : [];
  const status =
    data.adoptionStatus === 'pending'
    || data.adoptionStatus === 'adopted'
    || data.adoptionStatus === 'foster'
    || data.adoptionStatus === 'unavailable'
      ? data.adoptionStatus
      : 'available';
  return {
    id,
    shelterId: String(data.shelterId || ''),
    ownerUid: String(data.ownerUid || ''),
    name: String(data.name || ''),
    categoryId: String(data.categoryId || 'other'),
    breed: String(data.breed || ''),
    age: String(data.age || ''),
    sex: String(data.sex || ''),
    size: String(data.size || ''),
    description: String(data.description || ''),
    personality: String(data.personality || ''),
    vaccinationInfo: String(data.vaccinationInfo || ''),
    sterilized: !!data.sterilized,
    microchip: String(data.microchip || ''),
    adoptionStatus: status,
    location: String(data.location || ''),
    photos,
    primaryPhotoUrl: String(data.primaryPhotoUrl || pickPrimaryPhotoUrl(photos) || ''),
    createdAt: tsToIso(data.createdAt) || new Date().toISOString(),
    updatedAt: tsToIso(data.updatedAt),
  };
}

/**
 * @param {string} uid
 * @param {string} shelterId
 * @param {Partial<import('./shelterTypes').ShelterAnimal>} input
 */
export async function createShelterAnimal(uid, shelterId, input) {
  if (!isFirebaseConfigured() || !uid || !shelterId) return { ok: false, reason: 'bad_request' };
  const photos = Array.isArray(input.photos) ? input.photos : [];
  const ref = await addDoc(collection(getDb(), SHELTER_ANIMALS_COL), {
    shelterId,
    ownerUid: uid,
    name: String(input.name || '').trim().slice(0, 120),
    categoryId: String(input.categoryId || 'other').slice(0, 32),
    breed: String(input.breed || '').trim().slice(0, 120),
    age: String(input.age || '').trim().slice(0, 40),
    sex: String(input.sex || '').trim().slice(0, 20),
    size: String(input.size || '').trim().slice(0, 40),
    description: String(input.description || '').trim().slice(0, 4000),
    personality: String(input.personality || '').trim().slice(0, 2000),
    vaccinationInfo: String(input.vaccinationInfo || '').trim().slice(0, 1000),
    sterilized: !!input.sterilized,
    microchip: String(input.microchip || '').trim().slice(0, 80),
    adoptionStatus: input.adoptionStatus || 'available',
    location: String(input.location || '').trim().slice(0, 200),
    photos,
    primaryPhotoUrl: pickPrimaryPhotoUrl(photos),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ok: true, id: ref.id };
}

export async function updateShelterAnimal(animalId, uid, patch) {
  if (!isFirebaseConfigured() || !animalId || !uid) return { ok: false, reason: 'bad_request' };
  const ref = doc(getDb(), SHELTER_ANIMALS_COL, animalId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data()?.ownerUid !== uid) return { ok: false, reason: 'forbidden' };
  const photos = patch.photos ? patch.photos : undefined;
  await updateDoc(ref, {
    ...(patch.name != null ? { name: String(patch.name).slice(0, 120) } : {}),
    ...(patch.categoryId != null ? { categoryId: String(patch.categoryId).slice(0, 32) } : {}),
    ...(patch.breed != null ? { breed: String(patch.breed).slice(0, 120) } : {}),
    ...(patch.age != null ? { age: String(patch.age).slice(0, 40) } : {}),
    ...(patch.sex != null ? { sex: String(patch.sex).slice(0, 20) } : {}),
    ...(patch.size != null ? { size: String(patch.size).slice(0, 40) } : {}),
    ...(patch.description != null ? { description: String(patch.description).slice(0, 4000) } : {}),
    ...(patch.personality != null ? { personality: String(patch.personality).slice(0, 2000) } : {}),
    ...(patch.vaccinationInfo != null ? { vaccinationInfo: String(patch.vaccinationInfo).slice(0, 1000) } : {}),
    ...(patch.sterilized != null ? { sterilized: !!patch.sterilized } : {}),
    ...(patch.microchip != null ? { microchip: String(patch.microchip).slice(0, 80) } : {}),
    ...(patch.adoptionStatus != null ? { adoptionStatus: patch.adoptionStatus } : {}),
    ...(patch.location != null ? { location: String(patch.location).slice(0, 200) } : {}),
    ...(photos ? { photos, primaryPhotoUrl: pickPrimaryPhotoUrl(photos) } : {}),
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

export async function fetchShelterAnimalById(animalId) {
  if (!isFirebaseConfigured() || !animalId) return null;
  const snap = await getDoc(doc(getDb(), SHELTER_ANIMALS_COL, animalId));
  if (!snap.exists()) return null;
  return mapShelterAnimalDoc(snap.id, snap.data());
}

/**
 * @param {string} shelterId
 * @param {(rows: import('./shelterTypes').ShelterAnimal[]) => void} onNext
 */
export function subscribeShelterAnimals(shelterId, onNext) {
  if (!isFirebaseConfigured() || !shelterId) {
    onNext([]);
    return () => {};
  }
  const q = query(
    collection(getDb(), SHELTER_ANIMALS_COL),
    where('shelterId', '==', shelterId),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  return onSnapshot(q, (snap) => onNext(snap.docs.map((d) => mapShelterAnimalDoc(d.id, d.data()))), () => onNext([]));
}

/**
 * @param {(rows: import('./shelterTypes').ShelterAnimal[]) => void} onNext
 */
export function subscribeAvailableShelterAnimals(onNext) {
  if (!isFirebaseConfigured()) {
    onNext([]);
    return () => {};
  }
  const q = query(
    collection(getDb(), SHELTER_ANIMALS_COL),
    where('adoptionStatus', '==', 'available'),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  return onSnapshot(q, (snap) => onNext(snap.docs.map((d) => mapShelterAnimalDoc(d.id, d.data()))), () => onNext([]));
}
