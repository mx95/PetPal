#!/usr/bin/env node
/**
 * Delete the mistaken admin "Return review collar" pet (IMEI was restored to Oscar).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

const ADMIN_EMAIL = 'sotiris9515@gmail.com';
const ADMIN_PET_ID = 'SMLmgo4CczmN2VPx1HrS';
const PET_NAME = 'Return review collar';

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
  const auth = admin.auth();
  const db = admin.firestore();
  const uid = (await auth.getUserByEmail(ADMIN_EMAIL)).uid;

  const petRef = db.collection('users').doc(uid).collection('pets').doc(ADMIN_PET_ID);
  const snap = await petRef.get();
  if (snap.exists) {
    const name = String(snap.data()?.name || '');
    await petRef.delete();
    console.log(`Deleted admin pet ${ADMIN_PET_ID} (${name || PET_NAME})`);
  } else {
    // Fallback: delete by name
    const all = await db.collection('users').doc(uid).collection('pets').get();
    let n = 0;
    for (const d of all.docs) {
      if (String(d.data()?.name || '').trim().toLowerCase() === PET_NAME.toLowerCase()) {
        await d.ref.delete();
        console.log(`Deleted admin pet ${d.id} (${PET_NAME})`);
        n += 1;
      }
    }
    if (!n) console.log('No Return review collar pet found — already gone');
  }
  console.log('OK');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
