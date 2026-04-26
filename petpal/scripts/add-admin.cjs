#!/usr/bin/env node
/**
 * Creates Firestore document admins/{uid} so that user can open /admin/company-approvals.
 * Client apps cannot write /admins/* (see firestore.rules) — use this script or the Firebase console.
 *
 * Prerequisites (pick one):
 *   1) Service account key: download from Firebase Console → Project settings → Service accounts
 *      export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/serviceAccount.json"
 *   2) Or: gcloud auth application-default login
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=your-project-id node scripts/add-admin.cjs <firebase-uid>
 *   FIREBASE_PROJECT_ID=your-project-id node scripts/add-admin.cjs <owner@email.com>
 *
 * Project ID is usually the same as REACT_APP_FIREBASE_PROJECT_ID in .env.local
 */

const admin = require('firebase-admin');

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: node scripts/add-admin.cjs <uid|email>');
    process.exit(1);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    console.error('Set FIREBASE_PROJECT_ID (same as your Firebase / GCP project id).');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  let uid = raw;
  if (raw.includes('@')) {
    const user = await admin.auth().getUserByEmail(raw.trim().toLowerCase());
    uid = user.uid;
    console.log('Resolved email to UID:', uid);
  }

  const db = admin.firestore();
  await db.doc(`admins/${uid}`).set({
    role: 'admin',
    addedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`OK: admins/${uid} created or updated. Sign in with that account and open /admin/company-approvals.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
