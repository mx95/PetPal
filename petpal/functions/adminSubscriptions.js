/**
 * Admin tools for tracker / billing subscriptions: lookup, set next renewal, cancel, clear card.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

function ensureAdmin() {
  try {
    admin.app();
  } catch {
    admin.initializeApp();
  }
}

async function isAdminUid(db, uid) {
  if (!uid) return false;
  const snap = await db.collection('admins').doc(uid).get();
  return snap.exists;
}

function requireAdmin(context) {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in as admin.');
  }
}

function tsToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapTrackerSub(docSnap) {
  const d = docSnap.data() || {};
  return {
    kind: 'tracker',
    id: docSnap.id,
    path: docSnap.ref.path,
    uid: String(d.uid || ''),
    subscriptionId: String(d.subscriptionId || docSnap.id),
    paymentId: String(d.paymentId || d.orderNumber || ''),
    sku: String(d.sku || ''),
    status: String(d.status || ''),
    amountCents: Number.isFinite(Number(d.amountCents)) ? Number(d.amountCents) : null,
    currency: String(d.currency || 'EUR'),
    trackerImei: String(d.trackerImei || d.imei || ''),
    petId: String(d.petId || ''),
    petName: String(d.petName || ''),
    hasBinding: Boolean(d.bindingId),
    nextRenewalAt: tsToIso(d.nextRenewalAt),
    cancelledAt: tsToIso(d.cancelledAt),
    updatedAt: tsToIso(d.updatedAt),
  };
}

function mapBillingSub(docSnap) {
  const d = docSnap.data() || {};
  return {
    kind: 'billing',
    id: docSnap.id,
    path: docSnap.ref.path,
    uid: String(d.uid || ''),
    subscriptionId: docSnap.id,
    paymentId: String(d.paymentId || d.orderNumber || ''),
    sku: String(d.sku || docSnap.id.split('_').slice(1).join('_') || ''),
    status: String(d.status || ''),
    amountCents: Number.isFinite(Number(d.amountCents)) ? Number(d.amountCents) : null,
    currency: String(d.currency || 'EUR'),
    trackerImei: String(d.trackerImei || d.imei || ''),
    petId: '',
    petName: '',
    hasBinding: Boolean(d.bindingId),
    nextRenewalAt: tsToIso(d.nextRenewalAt),
    cancelledAt: tsToIso(d.cancelledAt),
    updatedAt: tsToIso(d.updatedAt),
  };
}

async function resolveUid(db, { email, uid }) {
  const direct = String(uid || '').trim();
  if (direct) return direct;
  const mail = String(email || '')
    .trim()
    .toLowerCase();
  if (!mail.includes('@')) {
    throw new functions.https.HttpsError('invalid-argument', 'Email or uid is required.');
  }
  try {
    const user = await admin.auth().getUserByEmail(mail);
    return user.uid;
  } catch (e) {
    if (e?.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found', 'No Auth user for that email.');
    }
    throw e;
  }
}

async function loadUserBundle(db, uid) {
  const authUser = await admin.auth().getUser(uid).catch(() => null);
  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.data() || {};

  const trackerSnap = await db.collection('users').doc(uid).collection('trackerSubscriptions').get();
  const tracker = trackerSnap.docs.map(mapTrackerSub);

  const billingQ = await db.collection('billingSubscriptions').where('uid', '==', uid).get();
  const billing = billingQ.docs.map(mapBillingSub);

  // Legacy docs keyed by uid_SKU even if uid field missing
  const legacySkus = [
    'PETPAL_PLUS_MONTHLY',
    'PETPAL_PLUS_YEARLY',
    'STORE_BOOST_MONTHLY',
    'STORE_BOOST_NEARBY_MONTHLY',
    'STORE_BOOST_BOOKINGS_MONTHLY',
  ];
  for (const sku of legacySkus) {
    const id = `${uid}_${sku}`;
    if (billing.some((b) => b.id === id)) continue;
    const snap = await db.collection('billingSubscriptions').doc(id).get();
    if (snap.exists) billing.push(mapBillingSub(snap));
  }

  const methodSnap = await db.collection('users').doc(uid).collection('billing').doc('defaultMethod').get();
  const method = methodSnap.exists ? methodSnap.data() || {} : null;

  const cancelSnap = await db.collection('users').doc(uid).collection('cancelRequests').get();
  const cancelRequests = cancelSnap.docs.map((d) => {
    const x = d.data() || {};
    return {
      id: d.id,
      status: String(x.status || ''),
      sku: String(x.sku || ''),
      imei: String(x.imei || ''),
      createdAt: tsToIso(x.createdAt),
    };
  });

  return {
    uid,
    email: authUser?.email || String(userData.email || ''),
    name: String(userData.displayName || userData.name || authUser?.displayName || ''),
    trackerSubscriptions: tracker,
    billingSubscriptions: billing,
    paymentMethod: method
      ? {
          hasBinding: Boolean(method.bindingId),
          maskedPan: method.maskedPan ? String(method.maskedPan) : null,
          provider: String(method.provider || 'jcc'),
          updatedAt: tsToIso(method.updatedAt),
        }
      : { hasBinding: false, maskedPan: null, provider: null, updatedAt: null },
    cancelRequests,
  };
}

function cancelPatch(reason) {
  return {
    status: 'cancelled',
    bindingId: null,
    nextRenewalAt: admin.firestore.FieldValue.delete(),
    cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    cancelReason: String(reason || 'admin').slice(0, 80),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

/** Lookup subscriptions + payment method by email or uid. */
exports.adminLookupSubscriptions = functions.region('europe-west1').https.onCall(async (data, context) => {
  ensureAdmin();
  requireAdmin(context);
  const db = admin.firestore();
  if (!(await isAdminUid(db, context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }
  const uid = await resolveUid(db, data || {});
  return { ok: true, ...(await loadUserBundle(db, uid)) };
});

/** Set exact nextRenewalAt on a tracker or billing subscription. */
exports.adminSetSubscriptionNextRenewal = functions.region('europe-west1').https.onCall(async (data, context) => {
  ensureAdmin();
  requireAdmin(context);
  const db = admin.firestore();
  if (!(await isAdminUid(db, context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }

  const uid = String(data?.uid || '').trim();
  const subscriptionId = String(data?.subscriptionId || '').trim();
  const kind = String(data?.kind || 'tracker').trim();
  const iso = String(data?.nextRenewalAt || '').trim();
  if (!uid || !subscriptionId) {
    throw new functions.https.HttpsError('invalid-argument', 'uid and subscriptionId are required.');
  }
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) {
    throw new functions.https.HttpsError('invalid-argument', 'nextRenewalAt must be a valid ISO date.');
  }

  const ref =
    kind === 'billing'
      ? db.collection('billingSubscriptions').doc(subscriptionId)
      : db.collection('users').doc(uid).collection('trackerSubscriptions').doc(subscriptionId);

  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Subscription not found.');
  }

  await ref.set(
    {
      nextRenewalAt: admin.firestore.Timestamp.fromDate(when),
      status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      nextRenewalSetByAdminAt: admin.firestore.FieldValue.serverTimestamp(),
      nextRenewalSetByAdminUid: context.auth.uid,
    },
    { merge: true }
  );

  return { ok: true, uid, subscriptionId, kind, nextRenewalAt: when.toISOString() };
});

/**
 * Cancel one subscription or all for a user. Clears bindingId / nextRenewalAt.
 * Optionally clears saved JCC card.
 */
exports.adminCancelSubscription = functions.region('europe-west1').https.onCall(async (data, context) => {
  ensureAdmin();
  requireAdmin(context);
  const db = admin.firestore();
  if (!(await isAdminUid(db, context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }

  const uid = String(data?.uid || '').trim();
  const subscriptionId = String(data?.subscriptionId || '').trim();
  const kind = String(data?.kind || 'tracker').trim();
  const cancelAll = Boolean(data?.cancelAll);
  const clearPaymentMethod = data?.clearPaymentMethod !== false;
  const reason = String(data?.reason || 'admin').slice(0, 80);

  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }

  const patch = cancelPatch(reason);
  const cancelled = [];

  if (cancelAll) {
    const trackerSnap = await db.collection('users').doc(uid).collection('trackerSubscriptions').get();
    for (const docSnap of trackerSnap.docs) {
      await docSnap.ref.set(patch, { merge: true });
      cancelled.push({ kind: 'tracker', id: docSnap.id });
    }
    const billingQ = await db.collection('billingSubscriptions').where('uid', '==', uid).get();
    for (const docSnap of billingQ.docs) {
      await docSnap.ref.set(patch, { merge: true });
      cancelled.push({ kind: 'billing', id: docSnap.id });
    }
    for (const sku of [
      'PETPAL_PLUS_MONTHLY',
      'PETPAL_PLUS_YEARLY',
      'STORE_BOOST_MONTHLY',
      'STORE_BOOST_NEARBY_MONTHLY',
      'STORE_BOOST_BOOKINGS_MONTHLY',
    ]) {
      const id = `${uid}_${sku}`;
      if (cancelled.some((c) => c.id === id)) continue;
      const snap = await db.collection('billingSubscriptions').doc(id).get();
      if (snap.exists) {
        await snap.ref.set(patch, { merge: true });
        cancelled.push({ kind: 'billing', id });
      }
    }
  } else {
    if (!subscriptionId) {
      throw new functions.https.HttpsError('invalid-argument', 'subscriptionId is required (or cancelAll).');
    }
    const ref =
      kind === 'billing'
        ? db.collection('billingSubscriptions').doc(subscriptionId)
        : db.collection('users').doc(uid).collection('trackerSubscriptions').doc(subscriptionId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Subscription not found.');
    }
    await ref.set(patch, { merge: true });
    cancelled.push({ kind, id: subscriptionId });
  }

  if (clearPaymentMethod) {
    await db
      .collection('users')
      .doc(uid)
      .collection('billing')
      .doc('defaultMethod')
      .set(
        {
          bindingId: null,
          maskedPan: null,
          clearedAt: admin.firestore.FieldValue.serverTimestamp(),
          clearedReason: reason,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  const reqSnap = await db.collection('users').doc(uid).collection('cancelRequests').get();
  for (const docSnap of reqSnap.docs) {
    const st = String(docSnap.data()?.status || '');
    if (st === 'completed') continue;
    await docSnap.ref.set(
      {
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedBy: context.auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return { ok: true, uid, cancelled, paymentMethodCleared: clearPaymentMethod };
});

/** Clear saved JCC card only. */
exports.adminClearPaymentMethod = functions.region('europe-west1').https.onCall(async (data, context) => {
  ensureAdmin();
  requireAdmin(context);
  const db = admin.firestore();
  if (!(await isAdminUid(db, context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }
  const uid = String(data?.uid || '').trim();
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }
  await db
    .collection('users')
    .doc(uid)
    .collection('billing')
    .doc('defaultMethod')
    .set(
      {
        bindingId: null,
        maskedPan: null,
        clearedAt: admin.firestore.FieldValue.serverTimestamp(),
        clearedReason: 'admin_clear_card',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  return { ok: true, uid };
});
