#!/usr/bin/env node
/**
 * Undo accidental IMEI reassignment: put 868022030666239 back on Oscar
 * (uid tcsS9Yrg2ib26rewxGnSu47iaen2 / pet Um2lqxibK436FgEJhNAG) and clear
 * the admin "Return review collar" pet created for return review.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

const IMEI = '868022030666239';
const OWNER_UID = 'tcsS9Yrg2ib26rewxGnSu47iaen2';
const OWNER_PET_ID = 'Um2lqxibK436FgEJhNAG';
const OWNER_PET_NAME = 'Oscar';
const ADMIN_EMAIL = 'sotiris9515@gmail.com';
const ADMIN_PET_ID = 'SMLmgo4CczmN2VPx1HrS';

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
    const adc = fs
      .readdirSync(firebaseDir)
      .filter((f) => f.endsWith('_application_default_credentials.json'))
      .map((f) => path.join(firebaseDir, f));
    for (const f of adc) {
      if (existingFile(f)) return f;
    }
  }

  const configstorePaths = [
    path.join(home, '.config', 'configstore', 'firebase-tools.json'),
  ];
  for (const cfgPath of configstorePaths) {
    if (!existingFile(cfgPath)) continue;
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      let refresh = cfg?.tokens?.refresh_token;
      if (!refresh && Array.isArray(cfg?.activeAccounts)) {
        refresh = cfg.activeAccounts[0]?.tokens?.refresh_token;
      }
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
  const projectId = process.env.FIREBASE_PROJECT_ID || 'petpal-aecda';
  const credPath = resolveCredentialsPath();
  if (credPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
    console.log('Using credentials:', credPath);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();
  const auth = admin.auth();
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Restore Oscar
  await db
    .collection('users')
    .doc(OWNER_UID)
    .collection('pets')
    .doc(OWNER_PET_ID)
    .set(
      {
        trackingDeviceId: IMEI,
        linkedTracker: true,
        updatedAt: now,
      },
      { merge: true }
    );
  console.log(`Restored IMEI on ${OWNER_PET_NAME} (${OWNER_PET_ID}) uid=${OWNER_UID}`);

  await db.collection('trackerImeiIndex').doc(IMEI).set(
    {
      uid: OWNER_UID,
      petId: OWNER_PET_ID,
      petName: OWNER_PET_NAME,
      updatedAt: now,
    },
    { merge: true }
  );
  console.log('Restored trackerImeiIndex → Oscar');

  // Clear admin review pet (keep the pet row but unlink collar)
  let adminUid = null;
  try {
    adminUid = (await auth.getUserByEmail(ADMIN_EMAIL)).uid;
  } catch (e) {
    console.warn('Could not resolve admin uid via Auth:', e?.message || e);
  }

  if (adminUid) {
    const adminPetRef = db
      .collection('users')
      .doc(adminUid)
      .collection('pets')
      .doc(ADMIN_PET_ID);
    const adminPet = await adminPetRef.get();
    if (adminPet.exists) {
      await adminPetRef.set(
        {
          trackingDeviceId: null,
          linkedTracker: false,
          updatedAt: now,
        },
        { merge: true }
      );
      console.log(`Cleared IMEI from admin pet ${ADMIN_PET_ID}`);
    } else {
      console.log(`Admin pet ${ADMIN_PET_ID} not found — nothing to clear`);
    }
  }

  console.log('OK — Oscar keeps the collar; use /admin/tracker-location for admin review.');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
