#!/usr/bin/env node
/**
 * Populate Firestore nearbyPlacesCache (CY + GR) using Google Places Nearby Search.
 *
 * Usage (on server with serviceAccount.json):
 *   GOOGLE_PLACES_API_KEY=... node scripts/bootstrap-nearby-places-cache.cjs
 *
 * Reads key from env, /var/lib/petpal/places-api-key, or petpal/.env.local when unset.
 */
const fs = require('fs');
const path = require('path');

const PROJECT = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'petpal-aecda';
const PETPAL_DIR = path.join(__dirname, '..');

function readPlacesKey() {
  if (process.env.GOOGLE_PLACES_API_KEY) {
    return String(process.env.GOOGLE_PLACES_API_KEY).trim();
  }
  const keyFile = process.env.PLACES_KEY_FILE || '/var/lib/petpal/places-api-key';
  if (fs.existsSync(keyFile)) {
    return fs.readFileSync(keyFile, 'utf8').trim();
  }
  const envLocal = path.join(PETPAL_DIR, '.env.local');
  if (fs.existsSync(envLocal)) {
    const line = fs
      .readFileSync(envLocal, 'utf8')
      .split('\n')
      .find((row) => /^GOOGLE_PLACES_API_KEY=/.test(row));
    if (line) {
      return line.replace(/^GOOGLE_PLACES_API_KEY=/, '').trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

async function main() {
  const key = readPlacesKey();
  if (!key) {
    console.error('[nearby-bootstrap] Missing GOOGLE_PLACES_API_KEY');
    process.exit(1);
  }
  process.env.GOOGLE_PLACES_API_KEY = key;

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const candidates = ['/root/serviceAccount.json', path.join(PETPAL_DIR, 'serviceAccount.json')];
    const sa = candidates.find((p) => fs.existsSync(p));
    if (sa) process.env.GOOGLE_APPLICATION_CREDENTIALS = sa;
  }

  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT });
  }

  const metaSnap = await admin.firestore().doc('adminConfig/nearbyPlaces').get();
  const meta = metaSnap.exists ? metaSnap.data() : {};
  if (meta.status === 'ready' && process.env.FORCE_NEARBY_BOOTSTRAP !== '1') {
    console.log('[nearby-bootstrap] Cache already ready — set FORCE_NEARBY_BOOTSTRAP=1 to rebuild');
    return;
  }

  // eslint-disable-next-line global-require
  const { refreshAllNearbyPlacesCache } = require('../functions/nearbyPlacesCache')._internal;
  console.log('[nearby-bootstrap] Starting full CY + GR refresh…');
  const result = await refreshAllNearbyPlacesCache(key);
  console.log('[nearby-bootstrap] Done', result);
}

main().catch((e) => {
  console.error('[nearby-bootstrap] Failed:', e?.message || e);
  process.exit(1);
});
