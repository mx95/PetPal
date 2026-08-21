#!/usr/bin/env node
/**
 * Hide (or delete) the seeded PetPal demo business from Bookings / Nearby.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=petpal-aecda node scripts/disable-demo-business.cjs
 *
 * Optional:
 *   BIZ_EMAIL=business.demo@petpal.com.cy
 *   DELETE_DEMO=1   — also delete Auth user + company/provider docs
 */
const admin = require('firebase-admin');

const EMAIL = (process.env.BIZ_EMAIL || 'business.demo@petpal.com.cy').trim().toLowerCase();
const DELETE_DEMO = String(process.env.DELETE_DEMO || '').trim() === '1';

async function deleteCollectionDocs(db, collectionPath, batchSize = 100) {
  const col = db.collection(collectionPath);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await col.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'petpal-aecda';
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const auth = admin.auth();
  const db = admin.firestore();

  let user;
  try {
    user = await auth.getUserByEmail(EMAIL);
  } catch (err) {
    if (err?.code === 'auth/user-not-found') {
      console.log(`No auth user for ${EMAIL} — nothing to disable`);
      return;
    }
    throw err;
  }

  const uid = user.uid;
  const now = admin.firestore.FieldValue.serverTimestamp();
  console.log(`Found demo business uid=${uid} email=${EMAIL}`);

  await db.doc(`providers/${uid}`).set(
    {
      bookingEnabled: false,
      recommended: false,
      nearbyBoostActive: false,
      bookingsBoostActive: false,
      updatedAt: now,
      reviewNote: 'Demo business disabled',
    },
    { merge: true }
  );
  console.log(`Disabled providers/${uid} (bookingEnabled=false)`);

  await db.doc(`companies/${uid}`).set(
    {
      status: 'rejected',
      reviewNote: 'Demo business disabled',
      reviewedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  console.log(`Marked companies/${uid} as rejected`);

  if (!DELETE_DEMO) {
    console.log('Done (set DELETE_DEMO=1 to also delete Auth + Firestore docs)');
    return;
  }

  await deleteCollectionDocs(db, `companies/${uid}/services`);
  await deleteCollectionDocs(db, `companies/${uid}/availability`);
  await db.doc(`providers/${uid}`).delete().catch(() => {});
  await db.doc(`companies/${uid}`).delete().catch(() => {});
  await db.doc(`users/${uid}`).delete().catch(() => {});
  await db.doc('accountNames/petpal demo grooming').delete().catch(() => {});
  await auth.deleteUser(uid);
  console.log(`Deleted demo Auth user and related docs for ${uid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
