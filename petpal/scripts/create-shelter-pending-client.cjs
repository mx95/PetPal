#!/usr/bin/env node
/**
 * Seed a pending shelter using Firebase Auth + Firestore REST (no Admin SDK).
 * Reads REACT_APP_FIREBASE_API_KEY from petpal/.env.local when present.
 */
const fs = require('fs');
const path = require('path');

const EMAIL = (process.env.SHELTER_EMAIL || 'shelter.demo@petpal.com.cy').trim().toLowerCase();
const PASSWORD = process.env.SHELTER_PASSWORD || 'PetPalShelter2026!Demo';
const SHELTER_NAME = process.env.SHELTER_NAME || 'Limassol Paw Rescue';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'petpal-aecda';

function loadApiKey() {
  if (process.env.REACT_APP_FIREBASE_API_KEY) return process.env.REACT_APP_FIREBASE_API_KEY.trim();
  const envLocal = path.join(__dirname, '../.env.local');
  if (fs.existsSync(envLocal)) {
    const m = fs.readFileSync(envLocal, 'utf8').match(/^REACT_APP_FIREBASE_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('Set REACT_APP_FIREBASE_API_KEY or add it to petpal/.env.local');
}

async function authRequest(endpoint, body) {
  const apiKey = loadApiKey();
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error?.message || res.statusText), { json });
  return json;
}

async function ensureAuthUser() {
  try {
    return await authRequest('accounts:signUp', {
      email: EMAIL,
      password: PASSWORD,
      returnSecureToken: true,
    });
  } catch (err) {
    if (err.json?.error?.message !== 'EMAIL_EXISTS') throw err;
    return authRequest('accounts:signInWithPassword', {
      email: EMAIL,
      password: PASSWORD,
      returnSecureToken: true,
    });
  }
}

function firestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'object' && !Array.isArray(v)) {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, firestoreValue(val)])),
      },
    };
  }
  throw new Error(`unsupported value ${v}`);
}

async function firestoreSet(idToken, docPath, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, firestoreValue(v)])) }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || res.statusText);
  return json;
}

async function firestoreCreate(idToken, collectionPath, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, firestoreValue(v)])) }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || res.statusText);
  return json;
}

async function main() {
  const auth = await ensureAuthUser();
  const uid = auth.localId;
  const idToken = auth.idToken;
  const now = new Date().toISOString();

  await firestoreSet(idToken, `users/${uid}`, {
    uid,
    email: EMAIL,
    accountType: 'shelter',
    accountName: SHELTER_NAME,
    accountNameNormalized: SHELTER_NAME.trim().toLowerCase(),
    firstName: 'Demo',
    lastName: 'Shelter',
    phone: '+35799998840',
    updatedAt: now,
  });

  const shelter = await firestoreCreate(idToken, 'shelters', {
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
    rejectionNote: '',
    reviewNote: '',
  });

  const shelterId = shelter.name.split('/').pop();
  console.log('\n=== PetPal pending shelter (client REST) ===');
  console.log(`Email:    ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`UID:      ${uid}`);
  console.log(`Shelter:  ${shelterId}`);
  console.log('Status:   pending');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
