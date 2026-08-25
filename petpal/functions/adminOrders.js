/**
 * Admin: purge shop orders, keeping the newest paid (live) order.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

function ensureAdminApp() {
  try {
    admin.app();
  } catch {
    try {
      admin.initializeApp();
    } catch (e) {
      if (!e || e.code !== 'app/duplicate-app') throw e;
    }
  }
}

async function requireCallerAdmin(context) {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  }
  ensureAdminApp();
  const snap = await admin.firestore().doc(`admins/${context.auth.uid}`).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
  return context.auth.uid;
}

function orderTimeMs(data) {
  const ts = data?.paidAt || data?.createdAt || data?.updatedAt;
  if (ts?.toMillis) return ts.toMillis();
  if (typeof ts === 'string' || typeof ts === 'number') {
    const n = new Date(ts).getTime();
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Delete related payment indexes for an order (best-effort).
 */
async function deleteOrderSideDocs(db, orderNumber, data) {
  const batch = db.batch();
  let ops = 0;
  const sessionRef = db.collection('paymentSessions').doc(orderNumber);
  batch.delete(sessionRef);
  ops += 1;

  const uid = data?.uid ? String(data.uid) : '';
  if (uid) {
    batch.delete(db.collection('users').doc(uid).collection('payments').doc(orderNumber));
    batch.delete(db.collection('users').doc(uid).collection('shopOrders').doc(orderNumber));
    ops += 2;
  }

  const emailKey = String(data?.customerEmailNormalized || data?.customer?.emailNormalized || '')
    .trim()
    .toLowerCase();
  if (emailKey) {
    batch.delete(db.collection('customerPayments').doc(emailKey).collection('payments').doc(orderNumber));
    ops += 1;
  }

  await batch.commit();
  return ops;
}

/**
 * Keep the single newest paid order (prefer paymentMode=live when present),
 * delete every other order document (+ related indexes).
 */
exports.adminPurgeOrdersKeepLatestLive = functions
  .region('europe-west1')
  .https.onCall(async (_data, context) => {
    await requireCallerAdmin(context);
    const db = admin.firestore();
    const snap = await db.collection('orders').get();
    if (snap.empty) {
      return { ok: true, kept: null, deleted: 0 };
    }

    const rows = snap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() || {} }));
    const paid = rows.filter((r) => String(r.data.status || '') === 'paid');
    const livePaid = paid.filter((r) => String(r.data.paymentMode || '') === 'live');
    const keepPool = livePaid.length ? livePaid : paid.length ? paid : rows;

    keepPool.sort((a, b) => orderTimeMs(b.data) - orderTimeMs(a.data));
    const keep = keepPool[0];
    const toDelete = rows.filter((r) => r.id !== keep.id);

    let deleted = 0;
    for (const row of toDelete) {
      try {
        await deleteOrderSideDocs(db, row.id, row.data);
      } catch (e) {
        functions.logger.warn('order side-doc cleanup failed', { order: row.id, message: e?.message });
      }
      await row.ref.delete();
      deleted += 1;
    }

    return {
      ok: true,
      kept: {
        orderNumber: keep.id,
        status: keep.data.status || null,
        paymentMode: keep.data.paymentMode || null,
        amountCents: keep.data.amountCents ?? null,
      },
      deleted,
    };
  });
