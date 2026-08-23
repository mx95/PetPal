#!/usr/bin/env node
/**
 * Delete test shop payments/orders, keeping one real order.
 * Also backfills NFC selectedDesignId onto the kept order when recoverable.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=petpal-aecda \
 *   KEEP_ORDER_ID=PP-1787406430913-ivctd7 \
 *   node scripts/clear-test-orders.cjs
 *
 * Optional:
 *   DRY_RUN=1  — list what would be deleted without writing
 */
const admin = require('firebase-admin');

const PROJECT = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'petpal-aecda';
const KEEP_ORDER_ID = String(process.env.KEEP_ORDER_ID || 'PP-1787406430913-ivctd7').trim();
const DRY_RUN = String(process.env.DRY_RUN || '') === '1';

function designIdFromCartKey(key) {
  const m = String(key || '').match(/-d(\d+)(?:-|$)/i);
  return m ? Number(m[1]) : null;
}

async function deleteIfExists(ref, label, deleted) {
  const snap = await ref.get();
  if (!snap.exists) return;
  if (DRY_RUN) {
    console.log(`[dry-run] would delete ${label}`);
    deleted.push(label);
    return;
  }
  await ref.delete();
  deleted.push(label);
  console.log(`deleted ${label}`);
}

async function purgeOrder(db, orderId, orderData) {
  const deleted = [];
  const uid = orderData?.uid || null;
  const emailNorm = String(
    orderData?.customerEmailNormalized || orderData?.customer?.emailNormalized || ''
  )
    .trim()
    .toLowerCase();

  await deleteIfExists(db.collection('orders').doc(orderId), `orders/${orderId}`, deleted);
  await deleteIfExists(db.collection('paymentSessions').doc(orderId), `paymentSessions/${orderId}`, deleted);

  if (uid) {
    await deleteIfExists(
      db.collection('users').doc(uid).collection('payments').doc(orderId),
      `users/${uid}/payments/${orderId}`,
      deleted
    );
    await deleteIfExists(
      db.collection('users').doc(uid).collection('shopOrders').doc(orderId),
      `users/${uid}/shopOrders/${orderId}`,
      deleted
    );
  }
  if (emailNorm) {
    await deleteIfExists(
      db.collection('customerPayments').doc(emailNorm).collection('payments').doc(orderId),
      `customerPayments/${emailNorm}/payments/${orderId}`,
      deleted
    );
  }
  return deleted;
}

async function backfillKeepOrderDesign(db, orderId) {
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    console.warn(`Keep order ${orderId} not found — skip design backfill`);
    return;
  }
  const order = orderSnap.data() || {};
  const items = Array.isArray(order.items) ? order.items : [];

  let cartItems = null;
  const sessionSnap = await db.collection('paymentSessions').doc(orderId).get();
  if (sessionSnap.exists) {
    cartItems = sessionSnap.data()?.cartItems;
  }
  if ((!Array.isArray(cartItems) || !cartItems.length) && order.uid) {
    const shopSnap = await db
      .collection('users')
      .doc(order.uid)
      .collection('shopOrders')
      .doc(orderId)
      .get();
    if (shopSnap.exists) cartItems = shopSnap.data()?.items;
  }

  const byKey = new Map();
  if (Array.isArray(cartItems)) {
    cartItems.forEach((row) => {
      if (row?.key) byKey.set(String(row.key), row);
    });
  }

  let changed = false;
  const nextItems = items.map((item) => {
    const fromCart = byKey.get(String(item.key));
    let selectedDesignId =
      item.selectedDesignId != null && Number.isFinite(Number(item.selectedDesignId))
        ? Number(item.selectedDesignId)
        : null;
    if (selectedDesignId == null && fromCart?.selectedDesignId != null) {
      selectedDesignId = Number(fromCart.selectedDesignId);
    }
    if (selectedDesignId == null) {
      selectedDesignId = designIdFromCartKey(item.key) || designIdFromCartKey(fromCart?.key);
    }
    if (selectedDesignId == null) return item;
    if (Number(item.selectedDesignId) === selectedDesignId && item.productId) return item;
    changed = true;
    return {
      ...item,
      selectedDesignId,
      productId: item.productId || fromCart?.productId || 'nfc-tag',
      subtitle: item.subtitle || fromCart?.subtitle || undefined,
    };
  });

  if (!changed) {
    console.log(`Keep order ${orderId}: design already present or not recoverable`);
    return;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] would backfill design on orders/${orderId}:`, nextItems.map((i) => i.selectedDesignId));
    return;
  }

  await orderRef.update({
    items: nextItems,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(
    `Backfilled NFC design on orders/${orderId}:`,
    nextItems.map((i) => ({ key: i.key, selectedDesignId: i.selectedDesignId }))
  );
}

async function main() {
  if (!KEEP_ORDER_ID) {
    console.error('KEEP_ORDER_ID is required');
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT });
  }
  const db = admin.firestore();
  console.log(`Project=${PROJECT} keep=${KEEP_ORDER_ID} dryRun=${DRY_RUN}`);

  const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(200).get();
  console.log(`Found ${snap.size} recent orders`);

  let purged = 0;
  for (const doc of snap.docs) {
    if (doc.id === KEEP_ORDER_ID) {
      console.log(`KEEP ${doc.id}`);
      continue;
    }
    console.log(`PURGE ${doc.id} status=${doc.data()?.status} sku=${doc.data()?.sku}`);
    await purgeOrder(db, doc.id, doc.data());
    purged += 1;
  }

  await backfillKeepOrderDesign(db, KEEP_ORDER_ID);
  console.log(`Done. Purged ${purged} order(s). Kept ${KEEP_ORDER_ID}.`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
