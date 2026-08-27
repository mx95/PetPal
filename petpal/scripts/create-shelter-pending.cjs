#!/usr/bin/env node
/**
 * Creates (or resets) a shelter account with a pending shelter application
 * waiting for admin approval.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=petpal-aecda node scripts/create-shelter-pending.cjs
 *
 * Optional env:
 *   SHELTER_EMAIL, SHELTER_PASSWORD, SHELTER_NAME
 */
const admin = require('firebase-admin');

const EMAIL = (process.env.SHELTER_EMAIL || 'shelter.demo@petpal.com.cy').trim().toLowerCase();
const PASSWORD = process.env.SHELTER_PASSWORD || 'PetPalShelter2026!Demo';
const SHELTER_NAME = process.env.SHELTER_NAME || 'Limassol Paw Rescue';

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
    await auth.updateUser(user.uid, {
      password: PASSWORD,
      displayName: SHELTER_NAME,
      emailVerified: true,
    });
    console.log(`Updated existing auth user ${user.uid}`);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
    user = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: SHELTER_NAME,
      emailVerified: true,
    });
    console.log(`Created auth user ${user.uid}`);
  }

  const uid = user.uid;
  const accountNameNormalized = SHELTER_NAME.trim().toLocaleLowerCase();
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.doc(`users/${uid}`).set(
    {
      uid,
      email: EMAIL,
      accountType: 'shelter',
      accountName: SHELTER_NAME,
      accountNameNormalized,
      firstName: 'Demo',
      lastName: 'Shelter',
      phone: '+35799998840',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc(`accountNames/${accountNameNormalized}`).set(
    {
      uid,
      accountType: 'shelter',
      accountName: SHELTER_NAME,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  const existing = await db.collection('shelters').where('ownerUid', '==', uid).limit(1).get();
  let shelterId;
  const shelterPayload = {
    ownerUid: uid,
    accountType: 'shelter',
    shelterName: SHELTER_NAME,
    organizationName: 'Limassol Paw Rescue Association',
    registrationDetails: 'Demo registration CY-SHELTER-2026-001',
    contactPerson: 'Maria Demetriou',
    phoneNumber: '+35799998840',
    publicEmail: EMAIL,
    addressLine: '28 Makarios Avenue, Limassol',
    website: 'https://petpal.com.cy',
    socialLinks: {},
    description:
      'Demo shelter application waiting for admin approval. We rescue and rehome dogs and cats across Limassol district.',
    logoUrl: '',
    coverPhotoUrl: '',
    lat: 34.6841,
    lng: 33.0379,
    city: 'Limassol',
    status: 'pending',
    submittedAt: now,
    reviewedAt: null,
    rejectionNote: '',
    reviewNote: '',
  };

  if (existing.empty) {
    const ref = db.collection('shelters').doc();
    shelterId = ref.id;
    await ref.set(shelterPayload);
    console.log(`Created pending shelter application ${shelterId}`);
  } else {
    shelterId = existing.docs[0].id;
    await existing.docs[0].ref.set(shelterPayload, { merge: true });
    console.log(`Reset shelter application ${shelterId} to pending`);
  }

  console.log('\n=== PetPal pending shelter account ===');
  console.log(`Email:    ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`UID:      ${uid}`);
  console.log(`Shelter:  ${shelterId}`);
  console.log(`Status:   pending (approve in Admin → Company approvals)`);
  console.log('Login:    https://petpal.com.cy/login');
  console.log('Apply:    https://petpal.com.cy/shelter/apply');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
