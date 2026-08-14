/**
 * Admin callables: switch site payment mode (test|live) and save JCC credentials.
 * Never returns passwords to the client.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {
  DEFAULT_TEST_REST,
  DEFAULT_LIVE_REST,
  normalizeMode,
  maskUser,
  restHost,
  slotConfigured,
  readSiteModeDoc,
  readJccSlots,
  publicSlotStatus,
} = require('./paymentMode');

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
  const adminSnap = await admin.firestore().doc(`admins/${context.auth.uid}`).get();
  if (!adminSnap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
  return context.auth.uid;
}

/** Status for Admin Tools — never includes passwords. */
exports.getSitePaymentModeStatus = functions.region('europe-west1').https.onCall(async (_data, context) => {
  await requireCallerAdmin(context);
  const db = admin.firestore();
  const site = await readSiteModeDoc(db);
  const slots = await readJccSlots(db);
  const activeRestDefault = site.mode === 'live' ? DEFAULT_LIVE_REST : DEFAULT_TEST_REST;
  const activeSlot = site.mode === 'live' ? slots.live : slots.test;
  return {
    mode: site.mode,
    updatedBy: site.updatedBy,
    test: publicSlotStatus(slots.test, DEFAULT_TEST_REST),
    live: publicSlotStatus(slots.live, DEFAULT_LIVE_REST),
    active: {
      mode: site.mode,
      ...publicSlotStatus(activeSlot, activeRestDefault),
    },
  };
});

/** Switch website payment mode between test and live. */
exports.setSitePaymentMode = functions.region('europe-west1').https.onCall(async (data, context) => {
  const uid = await requireCallerAdmin(context);
  const mode = normalizeMode(data?.mode);
  const db = admin.firestore();
  if (mode === 'live') {
    const slots = await readJccSlots(db);
    if (!slotConfigured(slots.live)) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Save live JCC credentials before switching to live mode.'
      );
    }
  }
  await db.doc('adminConfig/site').set(
    {
      mode,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true }
  );
  return { ok: true, mode };
});

/**
 * Save JCC credentials for test or live.
 * Password optional on update — empty keeps the existing password.
 */
exports.saveSiteJccCredentials = functions.region('europe-west1').https.onCall(async (data, context) => {
  const uid = await requireCallerAdmin(context);
  const mode = normalizeMode(data?.mode);
  const user = String(data?.user || '').trim();
  const pass = String(data?.pass || '').trim();
  const restBaseRaw = String(data?.restBase || '').trim().replace(/\/$/, '');
  const defaultRest = mode === 'live' ? DEFAULT_LIVE_REST : DEFAULT_TEST_REST;
  const restBase = restBaseRaw || defaultRest;

  if (restBase && !/^https:\/\//i.test(restBase)) {
    throw new functions.https.HttpsError('invalid-argument', 'REST base must be an https URL.');
  }

  const db = admin.firestore();
  const slots = await readJccSlots(db);
  const prev = mode === 'live' ? slots.live : slots.test;
  const nextUser = user || String(prev.user || '').trim();
  const nextPass = pass || String(prev.pass || '').trim();
  if (!nextUser) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter the JCC API login.');
  }
  if (!nextPass) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter the JCC API password.');
  }

  const nextSlot = {
    user: nextUser,
    pass: nextPass,
    restBase,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid,
  };

  await db.doc('adminConfig/jcc').set(
    {
      [mode]: nextSlot,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true }
  );

  return {
    ok: true,
    mode,
    userMasked: maskUser(nextUser),
    restHost: restHost(restBase),
  };
});
