import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

/**
 * Request cancellation — admin disables SIM/tracker on backend.
 * @param {{ uid: string, subscriptionId: string, sku: string, imei?: string }} params
 */
export async function requestSubscriptionCancel({ uid, subscriptionId, sku, imei }) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  const db = getDb();
  const ref = doc(db, 'users', uid, 'cancelRequests', subscriptionId);
  await setDoc(ref, {
    subscriptionId,
    sku,
    imei: imei || null,
    status: 'pending',
    note: 'User requested cancellation — disable SIM and tracker billing.',
    createdAt: serverTimestamp(),
  });
}
