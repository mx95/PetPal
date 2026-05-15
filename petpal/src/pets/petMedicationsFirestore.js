import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

function medicationsCol(uid, petId) {
  return collection(getDb(), 'users', uid, 'pets', petId, 'medications');
}

function normalizeTimes(raw) {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((t) => String(t || '').trim().slice(0, 5))
      .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
      .sort((a, b) => a.localeCompare(b));
  }
  const legacy = String(raw?.time || raw || '').trim().slice(0, 5);
  if (/^\d{1,2}:\d{2}$/.test(legacy)) return [legacy];
  return ['09:00'];
}

function normalizePillCount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(99, Math.floor(n));
}

function docToRow(d) {
  const x = d.data() || {};
  const times = normalizeTimes(x.times ?? x.time);
  const pillCount = normalizePillCount(x.pillCount ?? x.pills ?? 1);
  return {
    id: d.id,
    name: String(x.name || ''),
    times,
    time: times[0] || '09:00',
    pillCount,
    dosage: String(x.dosage || ''),
    notes: String(x.notes || ''),
    source: x.source === 'vet' ? 'vet' : 'owner',
    vetLabel: typeof x.vetLabel === 'string' ? x.vetLabel : '',
  };
}

export function formatMedicationFirestoreError(e, t) {
  const code = e?.code || '';
  if (code === 'permission-denied' || /insufficient permissions/i.test(String(e?.message || ''))) {
    return t('myPets.medsPermissionDenied');
  }
  return e?.message || t('common.errorGeneric');
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
      const rows = snap.docs.map(docToRow);
      rows.sort((a, b) => String(a.times[0] || '').localeCompare(String(b.times[0] || '')));
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
 * @param {{
 *   name: string,
 *   times?: string[],
 *   time?: string,
 *   pillCount?: number,
 *   dosage?: string,
 *   notes?: string,
 *   source?: 'owner'|'vet',
 *   vetLabel?: string,
 * }} payload
 */
export async function addPetMedication(uid, petId, payload) {
  if (!isFirebaseConfigured() || !uid || !petId) return;
  const name = String(payload?.name || '').trim().slice(0, 120);
  if (!name) throw new Error('medication_name_required');
  const times = normalizeTimes(payload?.times ?? payload?.time);
  const pillCount = normalizePillCount(payload?.pillCount);
  await addDoc(medicationsCol(uid, petId), {
    name,
    times,
    pillCount,
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
