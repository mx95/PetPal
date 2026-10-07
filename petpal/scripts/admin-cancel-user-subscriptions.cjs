#!/usr/bin/env node
/**
 * Admin: cancel all subscriptions for a user and strip JCC payment tokens / renewals.
 *
 * Usage:
 *   ADMIN_CANCEL_EMAIL=paschalidess@gmail.com node scripts/admin-cancel-user-subscriptions.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

const EMAIL = String(process.env.ADMIN_CANCEL_EMAIL || 'paschalidess@gmail.com')
  .trim()
  .toLowerCase();

const BILLING_SKUS = [
  'PETPAL_PLUS_MONTHLY',
  'PETPAL_PLUS_YEARLY',
  'STORE_BOOST_MONTHLY',
  'STORE_BOOST_NEARBY_MONTHLY',
  'STORE_BOOST_BOOKINGS_MONTHLY',
];

const FIREBASE_TOOLS_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_TOOLS_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function existingFile(p) {
  try {
    return p && fs.existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

function resolveCredentialsPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    '/root/serviceAccount.json',
    path.resolve(__dirname, '../serviceAccount.json'),
    path.resolve(__dirname, '../../serviceAccount.json'),
  ].filter(Boolean);
  for (const c of candidates) {
    const hit = existingFile(c);
    if (hit) return hit;
  }
  const home = process.env.HOME || os.homedir() || '/root';
  const firebaseDir = path.join(home, '.config', 'firebase');
  if (fs.existsSync(firebaseDir)) {
    for (const f of fs.readdirSync(firebaseDir)) {
      if (f.endsWith('_application_default_credentials.json')) {
        const full = path.join(firebaseDir, f);
        if (existingFile(full)) return full;
      }
    }
  }
  const cfgPath = path.join(home, '.config', 'configstore', 'firebase-tools.json');
  if (!existingFile(cfgPath)) return null;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    let refresh = cfg?.tokens?.refresh_token;
    if (!refresh && Array.isArray(cfg?.activeAccounts)) {
      refresh = cfg.activeAccounts[0]?.tokens?.refresh_token;
    }
    if (!refresh) {
      const m = JSON.stringify(cfg).match(/"refresh_token"\s*:\s*"([^"]+)"/);
      if (m) refresh = m[1];
    }
    if (!refresh) return null;
    const out = path.join(os.tmpdir(), `petpal-firebase-adc-${process.pid}.json`);
    fs.writeFileSync(
      out,
      JSON.stringify({
        client_id: FIREBASE_TOOLS_CLIENT_ID,
        client_secret: FIREBASE_TOOLS_CLIENT_SECRET,
        refresh_token: refresh,
        type: 'authorized_user',
      })
    );
    return out;
  } catch {
    return null;
  }
}

async function main() {
  if (!EMAIL.includes('@')) {
    console.error('ADMIN_CANCEL_EMAIL must be an email');
    process.exit(1);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'petpal-aecda';
  const credPath = resolveCredentialsPath();
  if (credPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
    console.log('Using credentials:', credPath);
  }

  if (!admin.apps.length) admin.initializeApp({ projectId });
  const auth = admin.auth();
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const deleteField = admin.firestore.FieldValue.delete();

  const user = await auth.getUserByEmail(EMAIL);
  const uid = user.uid;
  console.log(`Cancel target ${EMAIL} → ${uid}`);

  const cancelPatch = {
    status: 'cancelled',
    bindingId: null,
    nextRenewalAt: deleteField,
    cancelledAt: now,
    cancelReason: 'admin_refund',
    updatedAt: now,
  };

  // 1) Tracker subscriptions (monthly collar plans)
  const trackerSnap = await db.collection('users').doc(uid).collection('trackerSubscriptions').get();
  let trackerN = 0;
  for (const docSnap of trackerSnap.docs) {
    const prev = docSnap.data() || {};
    await docSnap.ref.set(cancelPatch, { merge: true });
    trackerN += 1;
    console.log(
      `  trackerSubscriptions/${docSnap.id}: ${prev.status || '?'} → cancelled` +
        (prev.bindingId ? ' (cleared bindingId)' : '')
    );
  }
  console.log(`Tracker subscriptions cancelled: ${trackerN}`);

  // 2) Legacy / boost billingSubscriptions
  let billingN = 0;
  for (const sku of BILLING_SKUS) {
    const ref = db.collection('billingSubscriptions').doc(`${uid}_${sku}`);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const prev = snap.data() || {};
    await ref.set(
      {
        ...cancelPatch,
        uid,
        sku,
      },
      { merge: true }
    );
    billingN += 1;
    console.log(`  billingSubscriptions/${uid}_${sku}: ${prev.status || '?'} → cancelled`);
  }
  // Also catch any other billingSubscriptions docs for this uid
  const billingQ = await db.collection('billingSubscriptions').where('uid', '==', uid).get();
  for (const docSnap of billingQ.docs) {
    const prev = docSnap.data() || {};
    if (String(prev.status || '') === 'cancelled') continue;
    await docSnap.ref.set(cancelPatch, { merge: true });
    billingN += 1;
    console.log(`  billingSubscriptions/${docSnap.id}: ${prev.status || '?'} → cancelled`);
  }
  console.log(`Billing subscriptions cancelled: ${billingN}`);

  // 3) Saved JCC card token
  const methodRef = db.collection('users').doc(uid).collection('billing').doc('defaultMethod');
  const methodSnap = await methodRef.get();
  if (methodSnap.exists) {
    const prev = methodSnap.data() || {};
    await methodRef.set(
      {
        bindingId: null,
        maskedPan: null,
        provider: prev.provider || 'jcc',
        clearedAt: now,
        clearedReason: 'admin_refund',
        updatedAt: now,
      },
      { merge: true }
    );
    console.log(`Cleared users/${uid}/billing/defaultMethod` + (prev.bindingId ? ` (was ${prev.bindingId})` : ''));
  } else {
    console.log('No defaultMethod payment token on file');
  }

  // 4) Mark any pending cancel requests done
  const reqSnap = await db.collection('users').doc(uid).collection('cancelRequests').get();
  let reqN = 0;
  for (const docSnap of reqSnap.docs) {
    const prev = docSnap.data() || {};
    if (String(prev.status || '') === 'completed') continue;
    await docSnap.ref.set(
      {
        status: 'completed',
        completedAt: now,
        completedBy: 'admin_refund_script',
        updatedAt: now,
      },
      { merge: true }
    );
    reqN += 1;
  }
  console.log(`Cancel requests completed: ${reqN}`);

  console.log('OK — renewals will not run (no active status / no bindingId).');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
