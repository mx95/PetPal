import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

/**
 * Share a pet profile with another PetPal user by email.
 * Creates a collaboration doc the recipient can read when signed in.
 * @param {{ ownerUid: string, petId: string, petName: string, email: string }} params
 */
export async function sharePetWithEmail({ ownerUid, petId, petName, email }) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalized || !normalized.includes('@')) throw new Error('Enter a valid email address');

  const db = getDb();
  let collaboratorUid = '';
  try {
    const usersSnap = await getDocs(query(collection(db, 'users'), where('email', '==', normalized)));
    if (!usersSnap.empty) {
      collaboratorUid = usersSnap.docs[0].id;
    }
  } catch {
    // lookup optional — invite still stored by email
  }

  if (collaboratorUid && collaboratorUid === ownerUid) {
    throw new Error('You cannot share a pet with yourself');
  }

  const shareId = `${petId}_${normalized.replace(/[^a-z0-9]/g, '_')}`;
  await setDoc(doc(db, 'petCollaborators', shareId), {
    petId,
    petName: String(petName || '').trim(),
    ownerUid,
    collaboratorEmail: normalized,
    collaboratorUid: collaboratorUid || null,
    permissions: ['view', 'track'],
    status: 'active',
    createdAt: serverTimestamp(),
  });

  return { shareId, collaboratorUid, collaboratorEmail: normalized };
}

/**
 * @param {string} uid
 * @param {string} email
 */
export async function fetchSharedPetsForUser(uid, email) {
  if (!isFirebaseConfigured()) return [];
  const db = getDb();
  const out = [];
  const seen = new Set();

  try {
    if (uid) {
      const byUid = await getDocs(
        query(collection(db, 'petCollaborators'), where('collaboratorUid', '==', uid))
      );
      byUid.docs.forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        out.push({ id: d.id, ...d.data() });
      });
    }

    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (normalized) {
      const byEmail = await getDocs(
        query(collection(db, 'petCollaborators'), where('collaboratorEmail', '==', normalized))
      );
      byEmail.docs.forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        out.push({ id: d.id, ...d.data() });
      });
    }
  } catch {
    // Rules may not be deployed yet — treat as no shares instead of crashing the app.
    return [];
  }

  return out.filter((row) => row.status !== 'cancelled');
}
