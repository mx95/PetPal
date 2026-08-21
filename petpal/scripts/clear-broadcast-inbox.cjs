#!/usr/bin/env node
/**
 * Delete all admin broadcast inbox messages (clears every user’s inbox).
 *
 * Tries Firebase Admin first; if credentials are missing, falls back to
 * `firebase firestore:delete` (same CLI auth used for rules deploy on the server).
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=petpal-aecda node scripts/clear-broadcast-inbox.cjs
 */
const { spawnSync } = require('child_process');
const path = require('path');

const PROJECT = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'petpal-aecda';

async function clearWithAdmin() {
  // Lazy-require so missing credentials do not crash before CLI fallback.
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT });
  }
  const db = admin.firestore();
  const col = db.collection('broadcastMessages');
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await col.limit(100).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    total += snap.size;
  }
  return total;
}

function clearWithFirebaseCli() {
  const args = [
    'firestore:delete',
    'broadcastMessages',
    '--recursive',
    '--force',
    `--project=${PROJECT}`,
    '--non-interactive',
  ];
  const localBin = path.join(__dirname, '..', 'node_modules', '.bin', 'firebase');
  const tries = [
    { cmd: 'firebase', args },
    { cmd: localBin, args },
    { cmd: 'npx', args: ['firebase-tools@13.29.1', ...args] },
  ];
  for (const attempt of tries) {
    const res = spawnSync(attempt.cmd, attempt.args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    if (res.status === 0) {
      console.log(res.stdout || 'firebase firestore:delete OK');
      return true;
    }
    const err = `${res.stderr || ''}${res.stdout || ''}`.trim();
    console.warn(`[clear-inbox] ${attempt.cmd} failed: ${err.slice(0, 400)}`);
  }
  return false;
}

async function main() {
  try {
    const deleted = await clearWithAdmin();
    console.log(`Cleared broadcastMessages via Admin SDK (${deleted} deleted)`);
    return;
  } catch (err) {
    console.warn(`[clear-inbox] Admin SDK failed: ${err?.message || err}`);
  }

  if (clearWithFirebaseCli()) {
    console.log('Cleared broadcastMessages via Firebase CLI');
    return;
  }

  console.error('Could not clear broadcastMessages (no Admin credentials and Firebase CLI failed)');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
