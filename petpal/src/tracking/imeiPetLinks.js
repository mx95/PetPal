import { collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';
import {
  normalizeTrackerImei,
  readTrackerImeiIndex,
  syncTrackerImeiIndex,
  trackerImeiQueryValues,
} from './trackerImeiIndex';

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} petDoc
 * @param {Record<string, Array<{ uid: string, petId: string, petName: string }>>} byImei
 */
function addPetDocLink(petDoc, byImei) {
  const data = petDoc.data() || {};
  const imei = normalizeTrackerImei(data.trackingDeviceId);
  const uid = petDoc.ref.parent?.parent?.id;
  if (!imei || !uid) return;
  if (!byImei[imei]) byImei[imei] = [];
  const exists = byImei[imei].some((r) => r.uid === uid && r.petId === petDoc.id);
  if (exists) return;
  byImei[imei].push({
    uid,
    petId: petDoc.id,
    petName: String(data.name || '').trim(),
  });
}

/**
 * Fallback: collection-group lookup (handles legacy pets before trackerImeiIndex existed).
 * @param {string[]} imeis
 * @param {Record<string, Array<{ uid: string, petId: string, petName: string }>>} byImei
 */
async function fetchImeiPetLinksFromFirestore(imeis, byImei) {
  const db = getDb();
  const targets = imeis.filter(Boolean);
  if (!targets.length) return;

  try {
    const seenQueries = new Set();

    for (const imei of targets) {
      for (const variant of trackerImeiQueryValues(imei)) {
        const key = `${typeof variant}:${String(variant)}`;
        if (seenQueries.has(key)) continue;
        seenQueries.add(key);
        const q = query(collectionGroup(db, 'pets'), where('trackingDeviceId', '==', variant));
        const snap = await getDocs(q);
        snap.docs.forEach((petDoc) => {
          addPetDocLink(petDoc, byImei);
          const data = petDoc.data() || {};
          const imeiKey = normalizeTrackerImei(data.trackingDeviceId);
          const uid = petDoc.ref.parent?.parent?.id;
          if (imeiKey && uid) {
            void syncTrackerImeiIndex(uid, petDoc.id, data.name, null, imeiKey);
          }
        });
      }
    }

    const stillMissing = targets.filter((imei) => !byImei[imei]?.length);
    for (let i = 0; i < stillMissing.length; i += 10) {
      const chunk = stillMissing.slice(i, i + 10);
      const q = query(collectionGroup(db, 'pets'), where('trackingDeviceId', 'in', chunk));
      const snap = await getDocs(q);
      snap.docs.forEach((petDoc) => {
        addPetDocLink(petDoc, byImei);
        const data = petDoc.data() || {};
        const imeiKey = normalizeTrackerImei(data.trackingDeviceId);
        const uid = petDoc.ref.parent?.parent?.id;
        if (imeiKey && uid) {
          void syncTrackerImeiIndex(uid, petDoc.id, data.name, null, imeiKey);
        }
      });
    }
  } catch {
    // Collection-group fallback may be blocked by rules; index rows still apply.
  }
}

/**
 * Resolve which app users linked each IMEI on My pets.
 * @param {string[]} imeis
 * @returns {Promise<Record<string, Array<{ uid: string, email: string, petId: string, petName: string }>>>}
 */
export async function fetchImeiPetLinks(imeis) {
  if (!isFirebaseConfigured()) return {};
  const unique = [...new Set((imeis || []).map((x) => normalizeTrackerImei(x)).filter(Boolean))];
  if (!unique.length) return {};

  /** @type {Record<string, Array<{ uid: string, petId: string, petName: string }>>} */
  const byImei = {};

  await Promise.all(
    unique.map(async (imei) => {
      const row = await readTrackerImeiIndex(imei);
      if (row) {
        if (!byImei[imei]) byImei[imei] = [];
        const exists = byImei[imei].some((r) => r.uid === row.uid && r.petId === row.petId);
        if (!exists) byImei[imei].push(row);
      }
    })
  );

  await fetchImeiPetLinksFromFirestore(unique, byImei);

  const uids = new Set();
  Object.values(byImei).forEach((rows) => rows.forEach((r) => uids.add(r.uid)));

  /** @type {Record<string, { email: string }>} */
  const users = {};
  const db = getDb();
  await Promise.all(
    [...uids].map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (!snap.exists()) {
          users[uid] = { email: '' };
          return;
        }
        users[uid] = { email: String(snap.data()?.email || '').trim() };
      } catch {
        users[uid] = { email: '' };
      }
    })
  );

  /** @type {Record<string, Array<{ uid: string, email: string, petId: string, petName: string }>>} */
  const out = {};
  for (const [imei, rows] of Object.entries(byImei)) {
    out[imei] = rows.map((r) => ({
      ...r,
      email: users[r.uid]?.email || '',
    }));
  }
  return out;
}
