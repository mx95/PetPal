import {
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
function tsToDate(v) {
  try {
    if (v?.toDate) return v.toDate();
  } catch {
    // ignore
  }
  return null;
}

function mapContactDoc(d) {
  const x = d.data() || {};
  return {
    id: d.id,
    name: String(x.name || ''),
    email: String(x.email || ''),
    subject: String(x.subject || ''),
    message: String(x.message || ''),
    uid: String(x.uid || ''),
    status: String(x.status || 'new'),
    emailed: Boolean(x.emailed),
    emailTo: String(x.emailTo || ''),
    emailSkipReason: x.emailSkipReason ? String(x.emailSkipReason) : '',
    createdAt: tsToDate(x.createdAt),
    emailedAt: tsToDate(x.emailedAt),
    adminNotes: x.adminNotes ? String(x.adminNotes) : '',
  };
}

/**
 * @param {(rows: ReturnType<typeof mapContactDoc>[]) => void} onNext
 * @param {(err: Error) => void} [onError]
 */
export function subscribeContactMessages(onNext, onError) {
  if (!isFirebaseConfigured()) {
    onNext([]);
    return () => {};
  }
  const db = getDb();
  const q = query(collection(db, 'contactMessages'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map(mapContactDoc)),
    (err) => {
      onError?.(err);
      onNext([]);
    }
  );
}

/**
 * @param {string} id
 * @param {{ status?: string, adminNotes?: string }} patch
 */
export async function adminUpdateContactMessage(id, patch) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  const db = getDb();
  await updateDoc(doc(db, 'contactMessages', id), {
    ...(patch.status != null ? { status: String(patch.status) } : {}),
    ...(patch.adminNotes != null ? { adminNotes: String(patch.adminNotes).slice(0, 2000) } : {}),
    updatedAt: serverTimestamp(),
  });
}
