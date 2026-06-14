import { collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

/**
 * Resolve which app users linked each IMEI on My pets.
 * @param {string[]} imeis
 * @returns {Promise<Record<string, Array<{ uid: string, email: string, petId: string, petName: string }>>>}
 */
export async function fetchImeiPetLinks(imeis) {
  if (!isFirebaseConfigured()) return {};
  const unique = [...new Set((imeis || []).map((x) => String(x || '').trim()).filter(Boolean))];
  if (!unique.length) return {};

  const db = getDb();
  /** @type {Record<string, Array<{ uid: string, petId: string, petName: string }>>} */
  const byImei = {};

  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const q = query(collectionGroup(db, 'pets'), where('trackingDeviceId', 'in', chunk));
    const snap = await getDocs(q);
    snap.docs.forEach((petDoc) => {
      const data = petDoc.data() || {};
      const imei = String(data.trackingDeviceId || '').trim();
      const uid = petDoc.ref.parent?.parent?.id;
      if (!imei || !uid) return;
      if (!byImei[imei]) byImei[imei] = [];
      byImei[imei].push({
        uid,
        petId: petDoc.id,
        petName: String(data.name || '').trim(),
      });
    });
  }

  const uids = new Set();
  Object.values(byImei).forEach((rows) => rows.forEach((r) => uids.add(r.uid)));

  /** @type {Record<string, { email: string }>} */
  const users = {};
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
