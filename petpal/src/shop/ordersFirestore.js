import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
/** @typedef {'pending_payment'|'paid'|'processing'|'shipped'|'delivered'|'cancelled'|'payment_failed'} OrderStatus */

export const ORDER_STATUS_LABEL_KEYS = {
  pending_payment: 'ordersPage.status.pendingPayment',
  paid: 'ordersPage.status.paid',
  processing: 'ordersPage.status.processing',
  shipped: 'ordersPage.status.shipped',
  delivered: 'ordersPage.status.delivered',
  cancelled: 'ordersPage.status.cancelled',
  payment_failed: 'ordersPage.status.paymentFailed',
};

export const ADMIN_FULFILLMENT_STATUSES = ['paid', 'processing', 'shipped', 'delivered', 'cancelled'];

export function formatOrderStatusLabel(status, t) {
  const key = ORDER_STATUS_LABEL_KEYS[status];
  if (!key || typeof t !== 'function') return status;
  const label = t(key);
  return label === key ? status : label;
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} d
 */
function mapOrderDoc(d) {
  const x = d.data() || {};
  return {
    id: d.id,
    orderNumber: String(x.orderNumber || d.id),
    paymentId: String(x.paymentId || x.orderNumber || d.id),
    uid: String(x.uid || ''),
    sku: String(x.sku || ''),
    status: String(x.status || 'pending_payment'),
    amountCents: Number(x.amountCents) || 0,
    currency: String(x.currency || '978'),
    items: Array.isArray(x.items) ? x.items : [],
    trackerSubscriptions: Array.isArray(x.trackerSubscriptions) ? x.trackerSubscriptions : [],
    shipping: x.shipping || {},
    customer: x.customer || {},
    customerEmailNormalized: String(x.customerEmailNormalized || x.customer?.emailNormalized || ''),
    includeTracker: Boolean(x.includeTracker),
    includeNfc: Boolean(x.includeNfc),
    needsFulfillment: Boolean(x.needsFulfillment),
    createdAt: x.createdAt,
    paidAt: x.paidAt,
    updatedAt: x.updatedAt,
    adminNotes: x.adminNotes ? String(x.adminNotes) : '',
  };
}

/**
 * @param {string} uid
 * @param {(rows: ReturnType<typeof mapOrderDoc>[]) => void} onNext
 * @param {(err: Error) => void} [onError]
 */
export function subscribeUserOrders(uid, onNext, onError) {
  if (!isFirebaseConfigured() || !uid) {
    onNext([]);
    return () => {};
  }
  const db = getDb();
  const q = query(collection(db, 'orders'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map(mapOrderDoc)),
    (err) => {
      onError?.(err);
      onNext([]);
    }
  );
}

/**
 * @param {string} orderNumber
 * @param {string} uid
 * @param {(row: ReturnType<typeof mapOrderDoc> | null) => void} onNext
 */
export function subscribeUserOrder(orderNumber, uid, onNext) {
  if (!isFirebaseConfigured() || !orderNumber || !uid) {
    onNext(null);
    return () => {};
  }
  const db = getDb();
  return onSnapshot(doc(db, 'orders', orderNumber), (snap) => {
    if (!snap.exists()) {
      onNext(null);
      return;
    }
    const row = mapOrderDoc(snap);
    if (row.uid !== uid) {
      onNext(null);
      return;
    }
    onNext(row);
  });
}

/**
 * @param {(rows: ReturnType<typeof mapOrderDoc>[]) => void} onNext
 * @param {(err: Error) => void} [onError]
 */
export function subscribeAllOrders(onNext, onError) {
  if (!isFirebaseConfigured()) {
    onNext([]);
    return () => {};
  }
  const db = getDb();
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map(mapOrderDoc)),
    (err) => {
      onError?.(err);
      onNext([]);
    }
  );
}

/**
 * @param {string} orderId
 * @param {{ status: OrderStatus, adminNotes?: string }} patch
 */
export async function adminUpdateOrder(orderId, patch) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  const db = getDb();
  await updateDoc(doc(db, 'orders', orderId), {
    status: patch.status,
    ...(patch.adminNotes != null ? { adminNotes: String(patch.adminNotes).slice(0, 2000) } : {}),
    updatedAt: serverTimestamp(),
  });
}
