import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

function petsCol(uid) {
  return collection(getDb(), 'users', uid, 'pets');
}

function tsToIso(v) {
  if (!v) return '';
  try {
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
  } catch {
    // ignore
  }
  return '';
}

export function subscribePets(uid, onNext, onError) {
  if (!isFirebaseConfigured() || !uid) {
    onNext([]);
    return () => {};
  }
  const q = query(petsCol(uid), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          name: String(x.name || ''),
          categoryId: String(x.categoryId || 'dog'),
          trackingDeviceId: x.trackingDeviceId ? String(x.trackingDeviceId) : null,
          createdAt: tsToIso(x.createdAt) || new Date().toISOString(),
          ...(typeof x.photoDataUrl === 'string' ? { photoDataUrl: x.photoDataUrl } : {}),
          ...(typeof x.colorScheme === 'string' ? { colorScheme: x.colorScheme } : {}),
          ...(typeof x.description === 'string' ? { description: x.description } : {}),
          ...(typeof x.age === 'string' ? { age: x.age } : {}),
          ...(Array.isArray(x.friendlyWith) ? { friendlyWith: x.friendlyWith.map((v) => String(v || '')) } : {}),
          ...(typeof x.breed === 'string' ? { breed: x.breed } : {}),
          ...(typeof x.microchipNo === 'string' ? { microchipNo: x.microchipNo } : {}),
          ...(typeof x.dateOfBirth === 'string' ? { dateOfBirth: x.dateOfBirth } : {}),
          ...(typeof x.identifyingMarks === 'string' ? { identifyingMarks: x.identifyingMarks } : {}),
          ...(typeof x.medicalNotes === 'string' ? { medicalNotes: x.medicalNotes } : {}),
          ...(typeof x.ownerName === 'string' ? { ownerName: x.ownerName } : {}),
          ...(typeof x.ownerPhone === 'string' ? { ownerPhone: x.ownerPhone } : {}),
          ...(typeof x.ownerEmail === 'string' ? { ownerEmail: x.ownerEmail } : {}),
          ...(typeof x.photoUrl === 'string' ? { photoUrl: x.photoUrl } : {}),
          ...(typeof x.photoStoragePath === 'string' ? { photoStoragePath: x.photoStoragePath } : {}),
          ...(typeof x.nfcTag === 'boolean' ? { nfcTag: x.nfcTag } : { nfcTag: false }),
          ...(typeof x.linkedTracker === 'boolean'
            ? { linkedTracker: x.linkedTracker }
            : { linkedTracker: Boolean(x.trackingDeviceId) }),
        };
      });
      onNext(rows);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function createPet(uid, pet) {
  if (!isFirebaseConfigured() || !uid) return;
  const refDoc = await addDoc(petsCol(uid), {
    ...pet,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return refDoc.id;
}

export async function patchPet(uid, petId, patch) {
  if (!isFirebaseConfigured() || !uid || !petId) return;
  await updateDoc(doc(getDb(), 'users', uid, 'pets', petId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePet(uid, petId) {
  if (!isFirebaseConfigured() || !uid || !petId) return;
  await deleteDoc(doc(getDb(), 'users', uid, 'pets', petId));
}
