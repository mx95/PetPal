/**
 * Admin: clear shared broadcast inbox (every user’s in-app Inbox).
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

async function assertAdmin(uid) {
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  }
  const snap = await admin.firestore().collection('admins').doc(uid).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
}

async function deleteAllBroadcastMessages() {
  const db = admin.firestore();
  const col = db.collection('broadcastMessages');
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await col.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

exports.clearBroadcastInbox = functions.region('europe-west1').https.onCall(async (_data, context) => {
  await assertAdmin(context.auth && context.auth.uid);
  const deleted = await deleteAllBroadcastMessages();
  return { ok: true, deleted };
});

/**
 * One-shot bootstrap: clear inbox then no-op on later invokes.
 * Deploy + call once from Admin tools or firebase functions:shell.
 */
exports.bootstrapClearBroadcastInbox = functions
  .region('europe-west1')
  .https.onCall(async (_data, context) => {
    await assertAdmin(context.auth && context.auth.uid);
    const marker = admin.firestore().doc('adminMeta/broadcastInboxCleared20260821');
    const existing = await marker.get();
    if (existing.exists) {
      return { ok: true, alreadyCleared: true, deleted: 0 };
    }
    const deleted = await deleteAllBroadcastMessages();
    await marker.set({
      clearedAt: admin.firestore.FieldValue.serverTimestamp(),
      clearedBy: context.auth.uid,
      deleted,
    });
    return { ok: true, alreadyCleared: false, deleted };
  });
