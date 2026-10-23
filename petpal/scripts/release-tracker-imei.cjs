#!/usr/bin/env node
/**
 * Release a collar IMEI so a new user can claim it:
 *  - Clear trackingDeviceId from every pet that has it
 *  - Delete trackerImeiIndex/{imei}
 *  - Clear trackerImei / imei on trackerSubscriptions that reference it
 *
 * Does NOT touch the tracker-server device row or EMNIFY card (keep those via admin API).
 *
 * Usage (on server with Admin SDK credentials):
 *   FIREBASE_PROJECT_ID=petpal-aecda \
 *   TRACKER_IMEI=868022030666239 \
 *   node scripts/release-tracker-imei.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

const IMEI = String(process.env.TRACKER_IMEI || '868022030666239').trim();

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
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'petpal-aecda';
  const imei = normalizeImei(IMEI);
  if (!imei) {
    console.error('TRACKER_IMEI must be 10–20 digits');
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
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  console.log(`Releasing IMEI ${imei} for new-user assignment…`);

  const petsSnap = await db
    .collectionGroup('pets')
    .where('trackingDeviceId', '==', imei)
    .get();

  let clearedPets = 0;
  for (const doc of petsSnap.docs) {
    const data = doc.data() || {};
    const uid = doc.ref.parent?.parent?.id || '?';
    await doc.ref.set(
      {
        trackingDeviceId: null,
        linkedTracker: false,
        updatedAt: now,
      },
      { merge: true }
    );
    clearedPets += 1;
    console.log(`Cleared pet uid=${uid} petId=${doc.id} name=${data.name || ''}`);
  }

  // Also match numeric legacy storage
  const n = Number(imei);
  if (Number.isSafeInteger(n)) {
    const petsNum = await db.collectionGroup('pets').where('trackingDeviceId', '==', n).get();
    for (const doc of petsNum.docs) {
      const data = doc.data() || {};
      const uid = doc.ref.parent?.parent?.id || '?';
      await doc.ref.set(
        {
          trackingDeviceId: null,
          linkedTracker: false,
          updatedAt: now,
        },
        { merge: true }
      );
      clearedPets += 1;
      console.log(`Cleared pet (numeric) uid=${uid} petId=${doc.id} name=${data.name || ''}`);
    }
  }

  const indexRef = db.collection('trackerImeiIndex').doc(imei);
  const indexSnap = await indexRef.get();
  if (indexSnap.exists) {
    await indexRef.delete();
    console.log('Deleted trackerImeiIndex/' + imei);
  } else {
    console.log('No trackerImeiIndex row');
  }

  let clearedSubs = 0;
  const subSnaps = await db.collectionGroup('trackerSubscriptions').get();
  for (const doc of subSnaps.docs) {
    const data = doc.data() || {};
    const subImei = normalizeImei(data.trackerImei || data.imei);
    if (subImei !== imei) continue;
    await doc.ref.set(
      {
        trackerImei: null,
        imei: null,
        petId: null,
        petName: null,
        updatedAt: now,
      },
      { merge: true }
    );
    clearedSubs += 1;
    console.log(`Cleared subscription ${doc.ref.path}`);
  }

  // Shop order line items may store assigned IMEI
  let clearedOrders = 0;
  try {
    const ordersSnap = await db.collection('orders').get();
    for (const doc of ordersSnap.docs) {
      const data = doc.data() || {};
      let changed = false;
      const lines = Array.isArray(data.lines) ? data.lines.map((line) => {
        if (!line || typeof line !== 'object') return line;
        const lineImei = normalizeImei(line.trackerImei || line.imei);
        if (lineImei !== imei) return line;
        changed = true;
        return { ...line, trackerImei: null, imei: null };
      }) : data.lines;
      const topImei = normalizeImei(data.trackerImei || data.imei);
      const patch = { updatedAt: now };
      if (changed) patch.lines = lines;
      if (topImei === imei) {
        patch.trackerImei = null;
        patch.imei = null;
        changed = true;
      }
      if (!changed) continue;
      await doc.ref.set(patch, { merge: true });
      clearedOrders += 1;
      console.log(`Cleared order ${doc.id}`);
    }
  } catch (e) {
    console.warn('Order scan skipped:', e?.message || e);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        imei,
        clearedPets,
        clearedSubs,
        clearedOrders,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
