import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

const COL = 'companies';
const ADMINS = 'admins';

export function companyDocRef(uid) {
  return doc(getDb(), COL, uid);
}

export function adminDocRef(uid) {
  return doc(getDb(), ADMINS, uid);
}

/**
 * @param {string} uid
 * @param {(data: import('./companyTypes').CompanyProfile | null) => void} onNext
 * @param {(err: Error) => void} [onError]
 * @returns {() => void}
 */
export function subscribeCompanyProfile(uid, onNext, onError) {
  if (!isFirebaseConfigured() || !uid) {
    onNext(null);
    return () => {};
  }
  return onSnapshot(
    companyDocRef(uid),
    (snap) => {
      if (!snap.exists()) {
        onNext(null);
        return;
      }
      onNext(/** @type {import('./companyTypes').CompanyProfile} */ (snap.data()));
    },
    (err) => (onError ? onError(err) : undefined)
  );
}

/**
 * @param {string} uid
 * @param {(isAdmin: boolean) => void} onNext
 * @returns {() => void}
 */
export function subscribeIsAdmin(uid, onNext) {
  if (!isFirebaseConfigured() || !uid) {
    onNext(false);
    return () => {};
  }
  return onSnapshot(adminDocRef(uid), (snap) => onNext(snap.exists()));
}

/**
 * @param {string} uid
 * @param {import('./companyTypes').CompanyApplicationInput} data
 */
export async function saveCompanyApplication(uid, data) {
  if (!isFirebaseConfigured()) throw new Error('firebase_unconfigured');
  const payload = {
    accountType: 'company',
    businessName: String(data.businessName || '').trim().slice(0, 120),
    addressLine: data.addressLine ? String(data.addressLine).trim().slice(0, 200) : '',
    publicEmail: data.publicEmail ? String(data.publicEmail).trim().slice(0, 120) : '',
    lat: Number(data.lat),
    lng: Number(data.lng),
    status: 'pending',
    submittedAt: serverTimestamp(),
  };
  if (!payload.businessName) throw new Error('business_name_required');
  if (Number.isNaN(payload.lat) || Number.isNaN(payload.lng)) throw new Error('location_required');
  await setDoc(companyDocRef(uid), payload, { merge: true });
}

/**
 * @returns {Promise<import('./companyTypes').CompanyProfile[]>}
 */
export async function fetchPendingCompanyApplications() {
  if (!isFirebaseConfigured()) return [];
  const tryOrdered = query(collection(getDb(), COL), where('status', '==', 'pending'), orderBy('submittedAt', 'asc'));
  try {
    const snap = await getDocs(tryOrdered);
    return snap.docs.map((d) => {
      const x = d.data();
      return { id: d.id, ...x };
    });
  } catch {
    const q2 = query(collection(getDb(), COL), where('status', '==', 'pending'));
    const snap = await getDocs(q2);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return list.sort((a, b) => {
      const ta = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
      const tb = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
      return ta - tb;
    });
  }
}

/**
 * @param {string} userId
 * @param {string} [note]
 */
export async function adminApproveCompany(userId, note) {
  await updateDoc(companyDocRef(userId), {
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewNote: note ? String(note).slice(0, 500) : '',
  });
}

/**
 * @param {string} userId
 * @param {string} [note]
 */
export async function adminRejectCompany(userId, note) {
  await updateDoc(companyDocRef(userId), {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    rejectionNote: String(note || '').slice(0, 500),
  });
}
