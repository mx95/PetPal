import { deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';
import { requestSubscriptionCancel } from './requestSubscriptionCancel';

const BOOST_SKU_BY_KIND = {
  nearby: 'STORE_BOOST_NEARBY_MONTHLY',
  bookings: 'STORE_BOOST_BOOKINGS_MONTHLY',
};

/**
 * Stop a business visibility boost immediately and request billing cancellation.
 * @param {{ uid: string, companyId: string, kind: 'nearby' | 'bookings' }} params
 */
export async function cancelBusinessBoost({ uid, companyId, kind }) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  const sku = BOOST_SKU_BY_KIND[kind];
  if (!sku) throw new Error('invalid_boost_kind');

  const db = getDb();
  const providerRef = doc(db, 'providers', companyId);
  const snap = await getDoc(providerRef);
  const cur = snap.data() || {};

  const patch = {
    updatedAt: serverTimestamp(),
  };
  if (kind === 'nearby') {
    patch.boostNearbyEnabled = false;
    patch.sponsored = false;
    patch.boostNearbyUntil = deleteField();
  } else {
    patch.boostBookingsEnabled = false;
    patch.recommended = false;
    patch.boostBookingsUntil = deleteField();
  }
  const stillNearby = kind === 'bookings' ? Boolean(cur.boostNearbyEnabled) : false;
  const stillBookings = kind === 'nearby' ? Boolean(cur.boostBookingsEnabled) : false;
  patch.boostEnabled = stillNearby || stillBookings;

  await setDoc(providerRef, patch, { merge: true });

  const billingRef = doc(db, 'billingSubscriptions', `${uid}_${sku}`);
  await setDoc(
    billingRef,
    {
      status: 'cancel_requested',
      cancelRequestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await requestSubscriptionCancel({
    uid,
    subscriptionId: `${uid}_${sku}`,
    sku,
    imei: null,
  });
}
