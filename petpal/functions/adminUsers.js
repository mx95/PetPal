/**
 * Admin: delete a Firebase Auth user and cascade common Firestore data.
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

async function deleteQueryInBatches(query, label) {
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await query.limit(300).get();
    if (snap.empty) break;
    const batch = admin.firestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    functions.logger.info('adminDeleteUser batch', { label, deleted: snap.size });
  }
  return deleted;
}

async function deleteSubcollection(parentRef, name) {
  const col = parentRef.collection(name);
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await col.limit(300).get();
    if (snap.empty) break;
    const batch = admin.firestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

exports.adminDeleteUser = functions.region('europe-west1').https.onCall(async (data, context) => {
  const adminUid = await requireCallerAdmin(context);
  const uid = String(data?.uid || '').trim();
  if (!uid || uid.length < 8) {
    throw new functions.https.HttpsError('invalid-argument', 'uid required.');
  }
  if (uid === adminUid) {
    throw new functions.https.HttpsError('failed-precondition', 'Cannot delete your own admin account.');
  }

  const db = admin.firestore();
  const targetAdmin = await db.doc(`admins/${uid}`).get();
  if (targetAdmin.exists) {
    throw new functions.https.HttpsError('failed-precondition', 'Refuse to delete another admin. Remove admins/{uid} first.');
  }

  const userRef = db.collection('users').doc(uid);
  let email = '';
  try {
    const authUser = await admin.auth().getUser(uid);
    email = String(authUser?.email || '').trim();
  } catch (e) {
    if (e?.code !== 'auth/user-not-found') {
      functions.logger.warn('adminDeleteUser getUser email', { uid, message: e?.message });
    }
  }
  if (!email) {
    try {
      const userSnap = await userRef.get();
      email = String(userSnap.data()?.email || '').trim();
    } catch {
      // ignore
    }
  }

  const summary = {
    pets: 0,
    publicPets: 0,
    payments: 0,
    shopOrders: 0,
    trackerSubscriptions: 0,
    inbox: 0,
  };

  // Pets owned by user
  const petsSnap = await userRef.collection('pets').get();
  for (const petDoc of petsSnap.docs) {
    const publicId = String(petDoc.data()?.publicId || '').trim();
    if (publicId) {
      try {
        await db.collection('publicPets').doc(publicId).delete();
        summary.publicPets += 1;
      } catch (e) {
        functions.logger.warn('publicPet delete failed', { publicId, message: e?.message });
      }
    }
    await petDoc.ref.delete();
    summary.pets += 1;
  }

  summary.payments = await deleteSubcollection(userRef, 'payments');
  summary.shopOrders = await deleteSubcollection(userRef, 'shopOrders');
  summary.trackerSubscriptions = await deleteSubcollection(userRef, 'trackerSubscriptions');
  summary.inbox = await deleteSubcollection(userRef, 'inbox');

  // Public pets that still point at this owner
  summary.publicPets += await deleteQueryInBatches(
    db.collection('publicPets').where('ownerUid', '==', uid),
    'publicPets-by-owner'
  );

  await userRef.delete().catch(() => {});

  try {
    await admin.auth().deleteUser(uid);
  } catch (e) {
    if (e?.code !== 'auth/user-not-found') {
      throw new functions.https.HttpsError('internal', e?.message || 'Auth delete failed.');
    }
  }

  return { ok: true, uid, email: email || null, summary };
});
