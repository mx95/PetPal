#!/usr/bin/env node
/**
 * Delete all admin broadcast inbox messages (clears every user’s inbox).
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=petpal-aecda node scripts/clear-broadcast-inbox.cjs
 */
const admin = require('firebase-admin');

async function deleteCollectionDocs(db, collectionPath, batchSize = 100) {
  const col = db.collection(collectionPath);
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await col.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    total += snap.size;
  }
  return total;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'petpal-aecda';
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  const deleted = await deleteCollectionDocs(db, 'broadcastMessages');
  console.log(`Cleared broadcastMessages (${deleted} deleted)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
