/**
 * Bind paid monthly tracker subscriptions to shipped device IMEIs and pets.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

function normalizeImei(raw) {
  const s = String(raw ?? '').trim();
  return /^\d{10,20}$/.test(s) ? s : '';
}

async function isAdminUid(db, uid) {
  if (!uid) return false;
  const snap = await db.collection('admins').doc(uid).get();
  return snap.exists;
}

/**
 * @param {*} db
 * @param {string} uid
 * @param {string} imei
 */
async function findPetByImei(db, uid, imei) {
  const variants = [imei];
  const n = Number(imei);
  if (Number.isSafeInteger(n)) variants.push(n);
  for (const value of variants) {
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('pets')
      .where('trackingDeviceId', '==', value)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

/**
 * @param {*} db
 * @param {string} orderNumber
 * @param {Array<{ subscriptionId: string, uid: string, includeTracker?: boolean, includeNfc?: boolean, nfcPetIds?: string[] }>} lines
 */
async function appendOrderTrackerSubscriptions(db, orderNumber, uid, lines) {
  if (!orderNumber || !uid || !Array.isArray(lines) || !lines.length) return;
  const paymentId = String(orderNumber).slice(0, 36);
  const normalized = lines
    .filter((row) => row.subscriptionId || row.subPaymentId)
    .map((row) => ({
      paymentId: String(row.paymentId || paymentId).slice(0, 36),
      subPaymentId: Number(row.subPaymentId) || null,
      subscriptionId: String(
        row.subscriptionId ||
          (row.subPaymentId ? `${paymentId}-S${row.subPaymentId}`.slice(0, 36) : row.subscriptionId || '')
      ).slice(0, 36),
      uid,
      includeTracker: Boolean(row.includeTracker),
      includeNfc: Boolean(row.includeNfc),
      nfcPetIds: Array.isArray(row.nfcPetIds) ? row.nfcPetIds.map(String).filter(Boolean).slice(0, 20) : [],
      trackerImei: null,
    }))
    .filter((row) => row.subscriptionId);
  if (!normalized.length) return;
  await db
    .collection('orders')
    .doc(orderNumber)
    .set(
      {
        trackerSubscriptions: admin.firestore.FieldValue.arrayUnion(...normalized),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

/** Admin assigns the IMEI printed on the shipped GPS collar to a paid subscription. */
exports.assignSubscriptionImei = functions.region('europe-west1').https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in as admin.');
  }
  const db = admin.firestore();
  if (!(await isAdminUid(db, context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }

  const uid = String(data?.uid || '').trim();
  let subscriptionId = String(data?.subscriptionId || '').trim();
  const paymentId = String(data?.paymentId || '').trim();
  const subPaymentId = Number(data?.subPaymentId);
  if (!subscriptionId && paymentId && Number.isFinite(subPaymentId) && subPaymentId > 0) {
    subscriptionId = `${paymentId}-S${subPaymentId}`.slice(0, 36);
  }
  const imei = normalizeImei(data?.imei);
  if (!uid || !subscriptionId) {
    throw new functions.https.HttpsError('invalid-argument', 'User and subscription id are required.');
  }
  if (!imei) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter a valid tracker IMEI (10–20 digits).');
  }

  const subRef = db.collection('users').doc(uid).collection('trackerSubscriptions').doc(subscriptionId);
  const subSnap = await subRef.get();
  if (!subSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Subscription not found.');
  }
  const sub = subSnap.data() || {};
  if (sub.status !== 'active') {
    throw new functions.https.HttpsError('failed-precondition', 'Subscription is not active.');
  }

  const activeSnap = await db
    .collection('users')
    .doc(uid)
    .collection('trackerSubscriptions')
    .where('status', '==', 'active')
    .get();
  const duplicate = activeSnap.docs.find((d) => {
    if (d.id === subscriptionId) return false;
    return normalizeImei(d.data()?.trackerImei || d.data()?.imei) === imei;
  });
  if (duplicate) {
    throw new functions.https.HttpsError('already-exists', 'This IMEI is already linked to another subscription.');
  }

  const patch = {
    trackerImei: imei,
    imei,
    imeiAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const petDoc = await findPetByImei(db, uid, imei);
  if (petDoc) {
    const pet = petDoc.data() || {};
    patch.petId = petDoc.id;
    patch.petName = String(pet.name || '').slice(0, 80);
  }

  await subRef.set(patch, { merge: true });

  const orderNumber = String(sub.createdFromOrderNumber || sub.orderNumber || '').trim();
  if (orderNumber) {
    const orderRef = db.collection('orders').doc(orderNumber);
    const orderSnap = await orderRef.get();
    if (orderSnap.exists) {
      const order = orderSnap.data() || {};
      const rows = Array.isArray(order.trackerSubscriptions) ? order.trackerSubscriptions : [];
      const nextRows = rows.map((row) =>
        String(row.subscriptionId) === subscriptionId ||
        (paymentId &&
          Number.isFinite(subPaymentId) &&
          String(row.paymentId) === paymentId &&
          Number(row.subPaymentId) === subPaymentId)
          ? { ...row, trackerImei: imei, subscriptionId }
          : row
      );
      await orderRef.set(
        { trackerSubscriptions: nextRows, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  }

  return { ok: true, imei, petId: patch.petId || null, petName: patch.petName || null };
});

/** When a user links a collar IMEI on My pets, attach the matching paid subscription. */
exports.linkTrackerSubscriptionPet = functions.region('europe-west1').https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in to link your subscription.');
  }
  const uid = context.auth.uid;
  const petId = String(data?.petId || '').trim();
  const imei = normalizeImei(data?.imei);
  if (!petId || !imei) {
    throw new functions.https.HttpsError('invalid-argument', 'Pet and IMEI are required.');
  }

  const db = admin.firestore();
  const petSnap = await db.collection('users').doc(uid).collection('pets').doc(petId).get();
  if (!petSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Pet not found.');
  }
  const pet = petSnap.data() || {};
  const petImei = normalizeImei(pet.trackingDeviceId);
  if (petImei !== imei) {
    throw new functions.https.HttpsError('invalid-argument', 'This pet is not linked to that IMEI.');
  }

  const subsSnap = await db
    .collection('users')
    .doc(uid)
    .collection('trackerSubscriptions')
    .where('status', '==', 'active')
    .get();

  let matched = null;
  for (const doc of subsSnap.docs) {
    const subImei = normalizeImei(doc.data()?.trackerImei || doc.data()?.imei);
    if (subImei === imei) {
      matched = doc;
      break;
    }
  }

  if (!matched) {
    throw new functions.https.HttpsError(
      'not-found',
      'No active subscription is registered for this collar IMEI yet. It may still be processing after shipment.'
    );
  }

  await matched.ref.set(
    {
      petId,
      petName: String(pet.name || '').slice(0, 80),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true, subscriptionId: matched.id };
});

exports.appendOrderTrackerSubscriptions = appendOrderTrackerSubscriptions;
exports.normalizeImei = normalizeImei;
