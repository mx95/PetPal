#!/usr/bin/env node
/**
 * Print Oscar's public /pet/ share URL (for admin return review).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

const OWNER_UID = 'tcsS9Yrg2ib26rewxGnSu47iaen2';
const OWNER_PET_ID = 'Um2lqxibK436FgEJhNAG';
const SITE = (process.env.SITE_URL || 'https://petpal.com.cy').replace(/\/$/, '');

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
  const projectId = process.env.FIREBASE_PROJECT_ID || 'petpal-aecda';
  const credPath = resolveCredentialsPath();
  if (credPath) process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  if (!admin.apps.length) admin.initializeApp({ projectId });
  const db = admin.firestore();

  const petSnap = await db.collection('users').doc(OWNER_UID).collection('pets').doc(OWNER_PET_ID).get();
  if (!petSnap.exists) {
    console.error('Oscar pet not found');
    process.exit(1);
  }
  const pet = petSnap.data() || {};
  let publicId =
    typeof pet.publicProfileId === 'string' && pet.publicProfileId.trim()
      ? pet.publicProfileId.trim()
      : '';

  if (!publicId) {
    const q = await db
      .collection('publicPets')
      .where('ownerUid', '==', OWNER_UID)
      .where('petId', '==', OWNER_PET_ID)
      .limit(1)
      .get();
    if (!q.empty) publicId = q.docs[0].id;
  }

  if (!publicId) {
    const q2 = await db
      .collection('publicPets')
      .where('ownerUid', '==', OWNER_UID)
      .limit(20)
      .get();
    for (const d of q2.docs) {
      const n = String(d.data()?.name || '').trim().toLowerCase();
      if (n === 'oscar') {
        publicId = d.id;
        break;
      }
    }
  }

  if (!publicId) {
    console.error('No publicPets profile for Oscar — owner may need to open My Pets once to publish.');
    console.log(`Fallback pet id path (may 404): ${SITE}/pet/${OWNER_PET_ID}`);
    process.exit(2);
  }

  const url = `${SITE}/pet/${encodeURIComponent(publicId)}`;
  console.log(`Oscar share link: ${url}`);
  console.log(`publicProfileId: ${publicId}`);
  console.log(`petId: ${OWNER_PET_ID}`);
  console.log(`name: ${pet.name || 'Oscar'}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
