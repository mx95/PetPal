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

function buildSubscriptionId(paymentId, subPaymentId) {
  return `${String(paymentId || '').trim()}-S${Number(subPaymentId) || 1}`.slice(0, 36);
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
 * @param {string} uid
 * @param {string} subscriptionId
 * @param {string} paymentId
 * @param {number} subPaymentId
 */
async function resolveSubscriptionRef(db, uid, subscriptionId, paymentId, subPaymentId) {
  const userSubs = db.collection('users').doc(uid).collection('trackerSubscriptions');
  const candidates = [];
  if (subscriptionId) candidates.push(subscriptionId);
  if (paymentId && Number.isFinite(subPaymentId) && subPaymentId > 0) {
    const built = buildSubscriptionId(paymentId, subPaymentId);
    if (!candidates.includes(built)) candidates.push(built);
  }

  for (const id of candidates) {
    const ref = userSubs.doc(id);
    const snap = await ref.get();
    if (snap.exists) return { ref, snap, subscriptionId: id };
  }

  if (paymentId && Number.isFinite(subPaymentId) && subPaymentId > 0) {
    const allSnap = await userSubs.limit(50).get();
    const match = allSnap.docs.find((d) => {
      const data = d.data() || {};
      return (
        String(data.paymentId || '') === String(paymentId).slice(0, 36) &&
        Number(data.subPaymentId) === subPaymentId
      );
    });
    if (match) {
      return { ref: match.ref, snap: match, subscriptionId: match.id };
    }
  }

  return null;
}

/**
 * Recover a missing subscription doc from the order so admin can still assign IMEI.
 * @param {*} db
 * @param {string} uid
 * @param {string} paymentId
 * @param {number} subPaymentId
 * @param {string} preferredSubscriptionId
 */
async function ensureSubscriptionFromOrder(db, uid, paymentId, subPaymentId, preferredSubscriptionId) {
  if (!uid || !paymentId) return null;
  const orderRef = db.collection('orders').doc(paymentId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return null;
  const order = orderSnap.data() || {};
  const rows = Array.isArray(order.trackerSubscriptions) ? order.trackerSubscriptions : [];
  const line =
    rows.find(
      (row) =>
        (preferredSubscriptionId && String(row.subscriptionId) === preferredSubscriptionId) ||
        (Number.isFinite(subPaymentId) &&
          Number(row.subPaymentId) === subPaymentId &&
          String(row.paymentId || paymentId) === paymentId)
    ) || null;

  const subscriptionId = String(
    preferredSubscriptionId ||
      line?.subscriptionId ||
      buildSubscriptionId(paymentId, subPaymentId || line?.subPaymentId || 1)
  ).slice(0, 36);
  if (!subscriptionId) return null;

  const ref = db.collection('users').doc(uid).collection('trackerSubscriptions').doc(subscriptionId);
  const existing = await ref.get();
  if (existing.exists) return { ref, snap: existing, subscriptionId };

  await ref.set(
    {
      uid,
      subscriptionId,
      paymentId: String(paymentId).slice(0, 36),
      subPaymentId: Number(subPaymentId) || Number(line?.subPaymentId) || 1,
      sku: 'PETPAL_PLUS_MONTHLY',
      status: 'active',
      includeTracker: line?.includeTracker !== false,
      includeNfc: Boolean(line?.includeNfc),
      nfcPetIds: Array.isArray(line?.nfcPetIds) ? line.nfcPetIds : null,
      trackerImei: null,
      imei: null,
      petId: null,
      petName: null,
      orderNumber: String(paymentId).slice(0, 36),
      createdFromOrderNumber: String(paymentId).slice(0, 36),
      recoveredByAdmin: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  const snap = await ref.get();
  return { ref, snap, subscriptionId };
}

/**
 * @param {*} db
 * @param {string} uid
 * @param {string} petId
 * @param {string} imei
 */
async function writePetTrackingDevice(db, uid, petId, imei) {
  const petRef = db.collection('users').doc(uid).collection('pets').doc(petId);
  const petSnap = await petRef.get();
  if (!petSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Pet not found.');
  }
  const pet = petSnap.data() || {};
  const prevImei = normalizeImei(pet.trackingDeviceId);

  // Refuse if another pet (any user) already owns this IMEI via index.
  const indexRef = db.collection('trackerImeiIndex').doc(imei);
  const indexSnap = await indexRef.get();
  if (indexSnap.exists) {
    const row = indexSnap.data() || {};
    if (row.uid && row.petId && (row.uid !== uid || row.petId !== petId)) {
      throw new functions.https.HttpsError(
        'already-exists',
        'This collar IMEI is already linked to another pet.'
      );
    }
  }

  await petRef.set(
    {
      trackingDeviceId: imei,
      linkedTracker: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (prevImei && prevImei !== imei) {
    const prevRef = db.collection('trackerImeiIndex').doc(prevImei);
    const prevSnap = await prevRef.get();
    if (prevSnap.exists) {
      const row = prevSnap.data() || {};
      if (row.uid === uid && row.petId === petId) {
        await prevRef.delete();
      }
    }
  }

  await indexRef.set(
    {
      uid,
      petId,
      petName: String(pet.name || '').slice(0, 80),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { petId, petName: String(pet.name || '').slice(0, 80), prevImei };
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
  let subscriptionId = String(data?.subscriptionId || '').trim().slice(0, 36);
  const paymentId = String(data?.paymentId || '').trim();
  const subPaymentId = Number(data?.subPaymentId);
  const petIdOpt = String(data?.petId || '').trim();
  if (!subscriptionId && paymentId && Number.isFinite(subPaymentId) && subPaymentId > 0) {
    subscriptionId = buildSubscriptionId(paymentId, subPaymentId);
  }
  const imei = normalizeImei(data?.imei);
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'User uid is required.');
  }
  if (!imei) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter a valid tracker IMEI (10–20 digits).');
  }

  let resolved = await resolveSubscriptionRef(db, uid, subscriptionId, paymentId, subPaymentId);
  if (!resolved) {
    resolved = await ensureSubscriptionFromOrder(db, uid, paymentId, subPaymentId, subscriptionId);
  }
  if (!resolved) {
    throw new functions.https.HttpsError(
      'not-found',
      `Subscription not found for this payment (${subscriptionId || paymentId || 'unknown'}).`
    );
  }

  const { ref: subRef, snap: subSnap } = resolved;
  subscriptionId = resolved.subscriptionId;
  const sub = subSnap.data() || {};
  if (sub.status && sub.status !== 'active') {
    throw new functions.https.HttpsError('failed-precondition', `Subscription is not active (status: ${sub.status}).`);
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
    status: 'active',
    imeiAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  let linkedPetId = null;
  let linkedPetName = null;

  if (petIdOpt) {
    const petWrite = await writePetTrackingDevice(db, uid, petIdOpt, imei);
    linkedPetId = petWrite.petId;
    linkedPetName = petWrite.petName;
    patch.petId = linkedPetId;
    patch.petName = linkedPetName;
  } else {
    const petDoc = await findPetByImei(db, uid, imei);
    if (petDoc) {
      linkedPetId = petDoc.id;
      linkedPetName = String((petDoc.data() || {}).name || '').slice(0, 80);
      patch.petId = linkedPetId;
      patch.petName = linkedPetName;
    } else {
      // Convenience: if the user has exactly one pet, attach the collar there too.
      const petsSnap = await db.collection('users').doc(uid).collection('pets').limit(2).get();
      if (petsSnap.size === 1) {
        const onlyPet = petsSnap.docs[0];
        const petWrite = await writePetTrackingDevice(db, uid, onlyPet.id, imei);
        linkedPetId = petWrite.petId;
        linkedPetName = petWrite.petName;
        patch.petId = linkedPetId;
        patch.petName = linkedPetName;
      }
    }
  }

  await subRef.set(patch, { merge: true });

  const orderNumber = String(sub.createdFromOrderNumber || sub.orderNumber || paymentId || '').trim();
  if (orderNumber) {
    const orderRef = db.collection('orders').doc(orderNumber);
    const orderSnap = await orderRef.get();
    if (orderSnap.exists) {
      const order = orderSnap.data() || {};
      const rows = Array.isArray(order.trackerSubscriptions) ? order.trackerSubscriptions : [];
      let matched = false;
      const nextRows = rows.map((row) => {
        const hit =
          String(row.subscriptionId) === subscriptionId ||
          (paymentId &&
            Number.isFinite(subPaymentId) &&
            String(row.paymentId) === paymentId &&
            Number(row.subPaymentId) === subPaymentId);
        if (hit) matched = true;
        return hit ? { ...row, trackerImei: imei, subscriptionId } : row;
      });
      if (!matched) {
        nextRows.push({
          paymentId: String(paymentId || orderNumber).slice(0, 36),
          subPaymentId: Number.isFinite(subPaymentId) ? subPaymentId : 1,
          subscriptionId,
          uid,
          includeTracker: true,
          includeNfc: Boolean(sub.includeNfc),
          nfcPetIds: Array.isArray(sub.nfcPetIds) ? sub.nfcPetIds : [],
          trackerImei: imei,
        });
      }
      await orderRef.set(
        { trackerSubscriptions: nextRows, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  }

  return { ok: true, imei, subscriptionId, petId: linkedPetId, petName: linkedPetName };
});

/** Admin sets a pet's collar IMEI (trackingDeviceId) from Users & NFC. */
exports.adminAssignPetTrackingDevice = functions.region('europe-west1').https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in as admin.');
  }
  const db = admin.firestore();
  if (!(await isAdminUid(db, context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }

  const uid = String(data?.uid || '').trim();
  const petId = String(data?.petId || '').trim();
  const clear = Boolean(data?.clear);
  const imei = clear ? '' : normalizeImei(data?.imei);

  if (!uid || !petId) {
    throw new functions.https.HttpsError('invalid-argument', 'User and pet id are required.');
  }
  if (!clear && !imei) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter a valid tracker IMEI (10–20 digits).');
  }

  const petRef = db.collection('users').doc(uid).collection('pets').doc(petId);
  const petSnap = await petRef.get();
  if (!petSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Pet not found.');
  }
  const pet = petSnap.data() || {};
  const prevImei = normalizeImei(pet.trackingDeviceId);

  if (clear || !imei) {
    await petRef.set(
      {
        trackingDeviceId: null,
        linkedTracker: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    if (prevImei) {
      const prevRef = db.collection('trackerImeiIndex').doc(prevImei);
      const prevSnap = await prevRef.get();
      if (prevSnap.exists) {
        const row = prevSnap.data() || {};
        if (row.uid === uid && row.petId === petId) await prevRef.delete();
      }
    }
    return { ok: true, imei: null, petId, cleared: true };
  }

  const write = await writePetTrackingDevice(db, uid, petId, imei);

  // Link matching paid subscription if admin already assigned this IMEI on an order.
  const subsSnap = await db
    .collection('users')
    .doc(uid)
    .collection('trackerSubscriptions')
    .where('status', '==', 'active')
    .get();
  for (const doc of subsSnap.docs) {
    const subImei = normalizeImei(doc.data()?.trackerImei || doc.data()?.imei);
    if (subImei === imei) {
      await doc.ref.set(
        {
          petId,
          petName: write.petName,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      break;
    }
  }

  return { ok: true, imei, petId, petName: write.petName };
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
