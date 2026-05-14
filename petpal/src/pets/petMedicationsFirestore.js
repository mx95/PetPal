import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

function medicationsCol(uid, petId) {
  return collection(getDb(), 'users', uid, 'pets', petId, 'medications');
}

/**
 * @param {string} uid
 * @param {string} petId
 * @param {(rows: Array<Record<string, unknown>>) => void} onNext
 * @param {(e: Error) => void} [onError]
 */
export function subscribePetMedications(uid, petId, onNext, onError) {
  if (!isFirebaseConfigured() || !uid || !petId) {
    onNext([]);
    return () => {};
  }
  const q = query(medicationsCol(uid, petId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const x = d.data() || {};
        return {
          id: d.id,
          name: String(x.name || ''),
          dosage: String(x.dosage || ''),
          time: String(x.time || ''),
          notes: String(x.notes || ''),
          source: x.source === 'vet' ? 'vet' : 'owner',
          vetLabel: typeof x.vetLabel === 'string' ? x.vetLabel : '',
        };
      });
      rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));
      onNext(rows);
    },
    (e) => {
      if (onError) onError(e);
    }
  );
}

/**
 * @param {string} uid
 * @param {string} petId
 * @param {{ name: string, time?: string, dosage?: string, notes?: string, source?: 'owner'|'vet', vetLabel?: string }} payload
 */
export async function addPetMedication(uid, petId, payload) {
  if (!isFirebaseConfigured() || !uid || !petId) return;
  const name = String(payload?.name || '').trim().slice(0, 120);
  if (!name) throw new Error('medication_name_required');
  const time = String(payload?.time || '09:00').trim().slice(0, 5);
  await addDoc(medicationsCol(uid, petId), {
    name,
    time,
    dosage: String(payload?.dosage || '').trim().slice(0, 120),
    notes: String(payload?.notes || '').trim().slice(0, 500),
    source: payload?.source === 'vet' ? 'vet' : 'owner',
    vetLabel: String(payload?.vetLabel || '').trim().slice(0, 120),
    createdAt: serverTimestamp(),
  });
}

export async function deletePetMedication(uid, petId, medicationId) {
  if (!isFirebaseConfigured() || !uid || !petId || !medicationId) return;
  await deleteDoc(doc(getDb(), 'users', uid, 'pets', petId, 'medications', medicationId));
}
