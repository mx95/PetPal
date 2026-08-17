import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
/** @param {unknown} value */
export function normalizeTrackerImei(value) {
  const s = String(value ?? '').trim();
  return /^\d{10,20}$/.test(s) ? s : '';
}

/** Firestore `in` / `==` on IMEI may be stored as string or number — query both. */
export function trackerImeiQueryValues(imei) {
  const s = normalizeTrackerImei(imei);
  if (!s) return [];
  const out = [s];
  const n = Number(s);
  if (Number.isSafeInteger(n)) out.push(n);
  return out;
}

/**
 * Keep admin device registry in sync when a pet links or unlinks a collar IMEI.
 * @param {string} uid
 * @param {string} petId
 * @param {string} petName
 * @param {unknown} prevImei
 * @param {unknown} nextImei
 */
export async function syncTrackerImeiIndex(uid, petId, petName, prevImei, nextImei) {
  if (!isFirebaseConfigured() || !uid || !petId) return;
  const db = getDb();
  const prev = normalizeTrackerImei(prevImei);
  const next = normalizeTrackerImei(nextImei);

  if (prev && prev !== next) {
    try {
      const prevRef = doc(db, 'trackerImeiIndex', prev);
      const prevSnap = await getDoc(prevRef);
      if (prevSnap.exists()) {
        const row = prevSnap.data() || {};
        if (row.uid === uid && row.petId === petId) {
          await deleteDoc(prevRef);
        }
      }
    } catch {
      // ignore
    }
  }

  if (!next) return;

  await setDoc(
    doc(db, 'trackerImeiIndex', next),
    {
      uid,
      petId,
      petName: String(petName || '').trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * @param {string} imei
 * @returns {Promise<{ uid: string, petId: string, petName: string } | null>}
 */
export async function readTrackerImeiIndex(imei) {
  if (!isFirebaseConfigured()) return null;
  const key = normalizeTrackerImei(imei);
  if (!key) return null;
  try {
    const snap = await getDoc(doc(getDb(), 'trackerImeiIndex', key));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    if (!data.uid || !data.petId) return null;
    return {
      uid: String(data.uid),
      petId: String(data.petId),
      petName: String(data.petName || '').trim(),
    };
  } catch {
    return null;
  }
}
