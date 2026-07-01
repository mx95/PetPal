#!/usr/bin/env node
/**
 * Creates (or resets) an approved PetPal business account with provider listing,
 * sample services, and open availability slots.
 *
 * Prerequisites (pick one):
 *   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json"
 *   gcloud auth application-default login
 *   firebase login on the host (uses application default credentials when available)
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=petpal-aecda node scripts/create-business-account.cjs
 *
 * Optional env:
 *   BIZ_EMAIL, BIZ_PASSWORD, BIZ_NAME
 */
const admin = require('firebase-admin');

const EMAIL = (process.env.BIZ_EMAIL || 'business.demo@petpal.com.cy').trim().toLowerCase();
const PASSWORD = process.env.BIZ_PASSWORD || 'PetPalBiz2026!Demo';
const BUSINESS_NAME = process.env.BIZ_NAME || 'PetPal Demo Grooming';

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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
    await auth.updateUser(user.uid, {
      password: PASSWORD,
      displayName: BUSINESS_NAME,
      emailVerified: true,
    });
    console.log(`Updated existing auth user ${user.uid}`);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
    user = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: BUSINESS_NAME,
      emailVerified: true,
    });
    console.log(`Created auth user ${user.uid}`);
  }

  const uid = user.uid;
  const companyId = uid;
  const accountNameNormalized = BUSINESS_NAME.trim().toLocaleLowerCase();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const companyPayload = {
    ownerUid: uid,
    accountType: 'company',
    businessName: BUSINESS_NAME,
    businessType: 'pet_shop',
    logoUrl: '',
    addressLine: 'Artemidos 4, Xylofagou',
    publicEmail: EMAIL,
    phoneNumber: '+35799997740',
    workingHours: 'Mon–Sat 09:00–18:00',
    lat: 34.9794,
    lng: 33.7489,
    status: 'approved',
    submittedAt: now,
    reviewedAt: now,
    reviewNote: 'Seeded test business account',
  };

  await db.doc(`users/${uid}`).set(
    {
      uid,
      email: EMAIL,
      accountType: 'company',
      accountName: BUSINESS_NAME,
      accountNameNormalized,
      firstName: 'Demo',
      lastName: 'Business',
      phone: '+35799997740',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc(`accountNames/${accountNameNormalized}`).set(
    {
      uid,
      accountType: 'company',
      accountName: BUSINESS_NAME,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc(`companies/${companyId}`).set(companyPayload, { merge: true });

  await db.doc(`providers/${companyId}`).set(
    {
      bookingEnabled: true,
      displayName: BUSINESS_NAME,
      address: 'Artemidos 4, Xylofagou, Cyprus',
      phone: '+35799997740',
      lat: 34.9794,
      lng: 33.7489,
      providerTypes: { vet: false, bath: true, saloon: true, hotel: false, shop: false },
      workingHours: 'Mon–Sat 09:00–18:00',
      slotIntervalMin: 30,
      bookingLimitPerDay: 12,
      staffCount: 2,
      boostEnabled: false,
      sponsored: false,
      recommended: true,
      updatedAt: now,
    },
    { merge: true }
  );

  const services = [
    {
      id: 'bath-brush',
      type: 'bath',
      name: 'Bath & brush',
      durationMin: 45,
      price: '€28',
      description: 'Coat wash and brush-out',
      active: true,
    },
    {
      id: 'full-grooming',
      type: 'saloon',
      name: 'Full grooming',
      durationMin: 75,
      price: '€45',
      description: 'Wash, trim, ears and nails',
      active: true,
    },
  ];

  for (const service of services) {
    await db.doc(`companies/${companyId}/services/${service.id}`).set(
      {
        type: service.type,
        name: service.name,
        durationMin: service.durationMin,
        price: service.price,
        description: service.description,
        active: service.active,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  const availabilityCol = db.collection(`companies/${companyId}/availability`);
  const existingSlots = await availabilityCol.limit(1).get();
  if (existingSlots.empty) {
    const batch = db.batch();
    let slotCount = 0;
    const base = new Date();
    for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
      const day = addDays(base, dayOffset);
      for (let hour = 10; hour < 16; hour += 1) {
        for (const minute of [0, 30]) {
          const start = new Date(day);
          start.setHours(hour, minute, 0, 0);
          const end = new Date(start.getTime() + 45 * 60 * 1000);
          const ref = availabilityCol.doc();
          batch.set(ref, {
            serviceId: 'bath-brush',
            status: 'open',
            capacity: 1,
            startAt: admin.firestore.Timestamp.fromDate(start),
            endAt: admin.firestore.Timestamp.fromDate(end),
            createdAt: now,
            updatedAt: now,
          });
          slotCount += 1;
        }
      }
    }
    await batch.commit();
    console.log(`Seeded ${slotCount} availability slots`);
  } else {
    console.log('Availability slots already exist — skipped seeding');
  }

  console.log('\n=== PetPal test business account ===');
  console.log(`Email:    ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`UID:      ${uid}`);
  console.log(`Company:  ${companyId}`);
  console.log('Login:    https://petpal.com.cy/login');
  console.log('Portal:   https://petpal.com.cy/provider');
  console.log('Bookings: https://petpal.com.cy/bookings');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
