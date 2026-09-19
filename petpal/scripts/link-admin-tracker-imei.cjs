#!/usr/bin/env node
/**
 * Link a collar IMEI to the admin account so Live / History can be reviewed in-app.
 *
 * Usage (on server with Admin SDK credentials OR Firebase CLI login):
 *   FIREBASE_PROJECT_ID=petpal-aecda \
 *   ADMIN_EMAIL=sotiris9515@gmail.com \
 *   TRACKER_IMEI=868022030666239 \
 *   node scripts/link-admin-tracker-imei.cjs
 *
 * Optional:
 *   PET_NAME="Return review collar"
 *   FORCE=1   — steal IMEI from another pet if already linked
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

const EMAIL = String(process.env.ADMIN_EMAIL || 'sotiris9515@gmail.com')
  .trim()
  .toLowerCase();
const IMEI = String(process.env.TRACKER_IMEI || '868022030666239').trim();
const PET_NAME = String(process.env.PET_NAME || 'Return review collar').trim();
const FORCE = String(process.env.FORCE || '1').trim() !== '0';

const FIREBASE_TOOLS_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_TOOLS_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function normalizeImei(value) {
  const s = String(value || '').replace(/\D/g, '');
  return /^\d{10,20}$/.test(s) ? s : '';
}

function existingFile(p) {
  try {
    return p && fs.existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

/** Prefer service account, else Firebase CLI application-default credentials. */
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
    const adc = fs
      .readdirSync(firebaseDir)
      .filter((f) => f.endsWith('_application_default_credentials.json'))
      .map((f) => path.join(firebaseDir, f));
    for (const f of adc) {
      if (existingFile(f)) return f;
    }
  }

  // Build ADC from firebase-tools configstore tokens if present.
  const configstorePaths = [
    path.join(home, '.config', 'configstore', 'firebase-tools.json'),
    path.join(home, '.config', 'configstore', 'firebase-tools.json'),
  ];
  for (const cfgPath of configstorePaths) {
    if (!existingFile(cfgPath)) continue;
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      const tokens =
        cfg?.tokens ||
        cfg?.meta?.tokens ||
        (Array.isArray(cfg?.activeAccounts) ? null : null) ||
        cfg?.user?.tokens;
      // firebase-tools v13 shape: { tokens: { refresh_token }, or accounts: [...] }
      let refresh = tokens?.refresh_token;
      if (!refresh && Array.isArray(cfg?.activeAccounts)) {
        refresh = cfg.activeAccounts[0]?.tokens?.refresh_token;
      }
      if (!refresh && cfg?.tokens?.refresh_token) refresh = cfg.tokens.refresh_token;
      // Newer: `users` / `tokens` nested
      if (!refresh && typeof cfg === 'object') {
        const raw = JSON.stringify(cfg);
        const m = raw.match(/"refresh_token"\s*:\s*"([^"]+)"/);
        if (m) refresh = m[1];
      }
      if (!refresh) continue;
      const out = path.join(os.tmpdir(), `petpal-firebase-adc-${process.pid}.json`);
      fs.writeFileSync(
        out,
        JSON.stringify(
          {
            client_id: FIREBASE_TOOLS_CLIENT_ID,
            client_secret: FIREBASE_TOOLS_CLIENT_SECRET,
            refresh_token: refresh,
            type: 'authorized_user',
          },
          null,
          2
        )
      );
      return out;
    } catch (e) {
      console.warn('Could not read firebase-tools config:', e?.message || e);
    }
  }
  return null;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'petpal-aecda';
  const imei = normalizeImei(IMEI);
  if (!imei) {
    console.error('TRACKER_IMEI must be 10–20 digits');
    process.exit(1);
  }
  if (!EMAIL.includes('@')) {
    console.error('ADMIN_EMAIL must be an email');
    process.exit(1);
  }

  const credPath = resolveCredentialsPath();
  if (credPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
    console.log('Using credentials:', credPath);
  } else {
    console.warn('No explicit credentials file — trying application default credentials');
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const auth = admin.auth();
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const user = await auth.getUserByEmail(EMAIL);
  const uid = user.uid;
  console.log(`Admin user ${EMAIL} → ${uid}`);

  await db.doc(`admins/${uid}`).set(
    {
      role: 'admin',
      email: EMAIL,
      updatedAt: now,
    },
    { merge: true }
  );

  await db.doc(`users/${uid}`).set(
    {
      uid,
      email: EMAIL,
      updatedAt: now,
    },
    { merge: true }
  );

  const indexRef = db.collection('trackerImeiIndex').doc(imei);
  const indexSnap = await indexRef.get();
  if (indexSnap.exists) {
    const row = indexSnap.data() || {};
    if (row.uid && row.petId && row.uid !== uid) {
      console.log(
        `IMEI currently linked to uid=${row.uid} petId=${row.petId} petName=${row.petName || ''}`
      );
      if (!FORCE) {
        console.error('Refusing to reassign (set FORCE=1 to move to admin).');
        process.exit(2);
      }
      const otherPetRef = db.collection('users').doc(row.uid).collection('pets').doc(row.petId);
      const otherPet = await otherPetRef.get();
      if (otherPet.exists) {
        await otherPetRef.set(
          {
            trackingDeviceId: null,
            linkedTracker: false,
            updatedAt: now,
          },
          { merge: true }
        );
        console.log(`Cleared IMEI from previous pet ${row.petId}`);
      }
      await indexRef.delete();
    } else if (row.uid === uid && row.petId) {
      // Ensure pet still has the field set.
      await db
        .collection('users')
        .doc(uid)
        .collection('pets')
        .doc(row.petId)
        .set(
          {
            trackingDeviceId: imei,
            linkedTracker: true,
            updatedAt: now,
          },
          { merge: true }
        );
      console.log(`IMEI already on admin pet ${row.petId} (${row.petName || ''}) — refreshed link`);
      console.log(`Open Tracking and select that pet — IMEI ${imei}`);
      return;
    }
  }

  const petsSnap = await db.collection('users').doc(uid).collection('pets').get();
  let petId = null;
  let petName = PET_NAME;

  for (const doc of petsSnap.docs) {
    const data = doc.data() || {};
    if (normalizeImei(data.trackingDeviceId) === imei) {
      petId = doc.id;
      petName = String(data.name || PET_NAME);
      break;
    }
  }
  if (!petId) {
    for (const doc of petsSnap.docs) {
      const data = doc.data() || {};
      if (String(data.name || '').trim().toLowerCase() === PET_NAME.toLowerCase()) {
        petId = doc.id;
        petName = String(data.name || PET_NAME);
        break;
      }
    }
  }

  if (!petId) {
    const petRef = db.collection('users').doc(uid).collection('pets').doc();
    petId = petRef.id;
    await petRef.set({
      name: PET_NAME,
      species: 'dog',
      trackingDeviceId: imei,
      linkedTracker: true,
      createdAt: now,
      updatedAt: now,
    });
    petName = PET_NAME;
    console.log(`Created pet ${petId} (${petName})`);
  } else {
    await db
      .collection('users')
      .doc(uid)
      .collection('pets')
      .doc(petId)
      .set(
        {
          trackingDeviceId: imei,
          linkedTracker: true,
          updatedAt: now,
        },
        { merge: true }
      );
    console.log(`Updated pet ${petId} (${petName}) with IMEI ${imei}`);
  }

  await indexRef.set(
    {
      uid,
      petId,
      petName: String(petName).slice(0, 80),
      updatedAt: now,
    },
    { merge: true }
  );

  console.log('OK');
  console.log(`  email: ${EMAIL}`);
  console.log(`  uid:   ${uid}`);
  console.log(`  pet:   ${petName} (${petId})`);
  console.log(`  imei:  ${imei}`);
  console.log('Sign in as that admin → Tracking → select the pet → Live / History.');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
