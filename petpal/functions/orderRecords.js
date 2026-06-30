/**
 * Shared order document helpers for JCC checkout + return.
 */

const ORDER_STATUSES = new Set([
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'payment_failed',
]);

const PLUS_SUBSCRIPTION_SKUS = new Set(['PETPAL_PLUS_MONTHLY', 'PETPAL_PLUS_YEARLY']);

function normalizeCustomerEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .slice(0, 160);
}

/** @param {string} paymentId @param {number} subPaymentId */
function buildSubscriptionId(paymentId, subPaymentId) {
  return `${paymentId}-S${subPaymentId}`.slice(0, 36);
}

/**
 * @param {Array<object>} items
 * @param {string} paymentId
 */
function annotateOrderItemsWithSubPayments(items, paymentId) {
  let subCounter = 0;
  return (items || []).map((item) => {
    if (!item?.sku || !PLUS_SUBSCRIPTION_SKUS.has(item.sku)) {
      return { ...item, paymentId: paymentId || null, subPaymentId: null };
    }
    subCounter += 1;
    return { ...item, paymentId, subPaymentId: subCounter };
  });
}

function normalizeShipping(raw) {
  const firstName = String(raw?.firstName || '').trim().slice(0, 60);
  const lastName = String(raw?.lastName || '').trim().slice(0, 60);
  const addressLine1 = String(raw?.addressLine1 || '').trim().slice(0, 120);
  const addressLine2 = String(raw?.addressLine2 || '').trim().slice(0, 120);
  const city = String(raw?.city || '').trim().slice(0, 80);
  const postalCode = String(raw?.postalCode || '').trim().slice(0, 20);
  const country = String(raw?.country || 'CY').trim().slice(0, 2) || 'CY';
  const receiverName = String(raw?.receiverName || [firstName, lastName].filter(Boolean).join(' ')).trim().slice(0, 120);
  const addressFromParts = [
    addressLine1,
    addressLine2,
    [postalCode, city].filter(Boolean).join(' '),
    country === 'CY' ? 'Cyprus' : country,
  ]
    .filter(Boolean)
    .join(', ');
  const address = String(raw?.address || addressFromParts).trim().slice(0, 500);
  return {
    receiverName,
    email: String(raw?.email || '').trim().slice(0, 160),
    phone: String(raw?.phone || '').trim().slice(0, 40),
    address,
    firstName,
    lastName,
    addressLine1,
    addressLine2,
    city,
    postalCode,
    country,
  };
}

function validateShipping(shipping) {
  if (!shipping.receiverName && !shipping.firstName) return 'First name is required.';
  if (!shipping.lastName && !shipping.receiverName) return 'Last name is required.';
  if (!shipping.email || !shipping.email.includes('@')) return 'A valid email is required.';
  if (!shipping.phone) return 'Phone number is required.';
  if (!shipping.addressLine1 && !shipping.address) return 'Delivery address is required.';
  if (!shipping.city) return 'City is required.';
  if (!shipping.postalCode) return 'Postal code is required.';
  return null;
}

/**
 * @param {string} sku
 * @param {{ cartItems?: Array, includeTracker?: boolean, includeNfc?: boolean, title?: string, chargeCents?: number }} ctx
 */
function buildOrderItems(sku, ctx) {
  if (sku === 'MARKETPLACE_CART' && Array.isArray(ctx.cartItems)) {
    return ctx.cartItems.map((row) => ({
      key: String(row.key || '').slice(0, 120),
      title: String(row.title || 'Item').slice(0, 160),
      subtitle: row.subtitle ? String(row.subtitle).slice(0, 200) : undefined,
      priceCents: Math.max(0, Number(row.priceCents) || 0),
      qty: Math.max(1, Number(row.qty) || 1),
      sku: row.sku ? String(row.sku).slice(0, 64) : undefined,
      saveCard: Boolean(row.saveCard),
      includeTracker: Boolean(row.includeTracker),
      includeNfc: Boolean(row.includeNfc),
      nfcPetIds: Array.isArray(row.nfcPetIds) ? row.nfcPetIds.map(String).filter(Boolean) : undefined,
      recurring: Boolean(row.recurring),
    }));
  }
  const items = [{ key: sku, title: ctx.title || sku, priceCents: ctx.chargeCents || 0, qty: 1 }];
  if (ctx.includeTracker) {
    items.push({ key: 'TRACKER_HARDWARE', title: 'GPS tracker device', priceCents: 3999, qty: 1 });
  }
  if (ctx.includeNfc) {
    items.push({ key: 'NFC_TAG_HARDWARE', title: 'NFC pet tag', priceCents: sku === 'PETPAL_PLUS_YEARLY' ? 0 : 999, qty: 1 });
  }
  return items;
}

function needsFulfillment(sku, session) {
  if (sku === 'MARKETPLACE_CART') return true;
  if (sku === 'TRACKER_HARDWARE' || sku === 'NFC_TAG_HARDWARE') return true;
  if (session?.includeTracker || session?.includeNfc) return true;
  return false;
}

/**
 * @param {*} db Firestore
 * @param {object} payload
 */
async function createPendingOrder(db, payload) {
  const {
    orderNumber,
    uid,
    sku,
    pricing,
    shipping,
    sessionCartItems,
    includeTracker,
    includeNfc,
    nfcPetIds,
    currency,
  } = payload;
  const items = annotateOrderItemsWithSubPayments(
    buildOrderItems(sku, {
      cartItems: sessionCartItems,
      includeTracker,
      includeNfc,
      title: pricing.title,
      chargeCents: pricing.chargeCents,
    }),
    orderNumber
  );
  const customerEmail = shipping.email;
  const customerEmailNormalized = normalizeCustomerEmail(customerEmail);
  const admin = require('firebase-admin');
  await db
    .collection('orders')
    .doc(orderNumber)
    .set({
      orderNumber,
      paymentId: orderNumber,
      uid,
      sku,
      status: 'pending_payment',
      amountCents: pricing.chargeCents,
      currency: currency || '978',
      items,
      shipping,
      customer: {
        uid,
        email: customerEmail,
        emailNormalized: customerEmailNormalized,
        name: shipping.receiverName,
        phone: shipping.phone,
      },
      customerEmailNormalized,
      includeTracker: Boolean(includeTracker),
      includeNfc: Boolean(includeNfc),
      nfcPetIds: Array.isArray(nfcPetIds) ? nfcPetIds : null,
      needsFulfillment: needsFulfillment(sku, { includeTracker, includeNfc }),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

/**
 * @param {*} db Firestore
 * @param {string} orderNumber
 * @param {string} status
 * @param {object} [extra]
 */
async function updateOrderStatus(db, orderNumber, status, extra = {}) {
  if (!ORDER_STATUSES.has(status)) return;
  const admin = require('firebase-admin');
  await db
    .collection('orders')
    .doc(orderNumber)
    .set(
      {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...extra,
      },
      { merge: true }
    );
}

/**
 * Mirror paid order to users/{uid}/payments and customerPayments/{email}/payments for admin lookup.
 * @param {*} db
 * @param {string} orderNumber
 */
async function recordCustomerPaymentIndex(db, orderNumber) {
  const admin = require('firebase-admin');
  const snap = await db.collection('orders').doc(orderNumber).get();
  if (!snap.exists) return;
  const order = snap.data() || {};
  const paymentId = String(order.paymentId || order.orderNumber || orderNumber).slice(0, 36);
  const uid = String(order.uid || '').trim();
  if (!uid || !paymentId) return;

  const email = String(order.customer?.email || order.shipping?.email || '').trim();
  const customerEmailNormalized =
    String(order.customerEmailNormalized || order.customer?.emailNormalized || normalizeCustomerEmail(email)).trim();

  const payload = {
    paymentId,
    orderNumber: paymentId,
    uid,
    email: email.slice(0, 160),
    customerEmailNormalized,
    amountCents: Math.max(0, Number(order.amountCents) || 0),
    currency: String(order.currency || '978'),
    status: String(order.status || 'paid'),
    sku: String(order.sku || ''),
    items: Array.isArray(order.items) ? order.items : [],
    trackerSubscriptions: Array.isArray(order.trackerSubscriptions) ? order.trackerSubscriptions : [],
    shipping: order.shipping || {},
    paidAt: order.paidAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('users').doc(uid).collection('payments').doc(paymentId).set(payload, { merge: true });
  if (customerEmailNormalized) {
    await db
      .collection('customerPayments')
      .doc(customerEmailNormalized)
      .collection('payments')
      .doc(paymentId)
      .set(payload, { merge: true });
  }
}

module.exports = {
  ORDER_STATUSES,
  PLUS_SUBSCRIPTION_SKUS,
  normalizeCustomerEmail,
  buildSubscriptionId,
  annotateOrderItemsWithSubPayments,
  normalizeShipping,
  validateShipping,
  buildOrderItems,
  createPendingOrder,
  updateOrderStatus,
  recordCustomerPaymentIndex,
};
