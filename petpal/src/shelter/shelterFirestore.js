import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { pickPrimaryPhotoUrl, tsToIso } from '../media/photoUploadUtils';
import { getDb, isFirebaseConfigured } from '../firebase';

const COL = 'shelters';
const ADMINS = 'admins';

export function shelterDocRef(shelterId) {
  return doc(getDb(), COL, shelterId);
}

function sheltersCol() {
  return collection(getDb(), COL);
}

/** @param {import('./shelterTypes').ShelterProfile[]} rows */
function pickPrimaryShelter(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const byStatus = (status) => rows.filter((x) => x?.status === status);
  const byNewest = (arr) =>
    [...arr].sort((a, b) => {
      const ta = a?.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
      const tb = b?.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
      return tb - ta;
    });
  return byNewest(byStatus('approved'))[0] || byNewest(byStatus('pending'))[0] || byNewest(byStatus('rejected'))[0] || rows[0];
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} data
 * @returns {import('./shelterTypes').ShelterProfile}
 */
export function mapShelterDoc(id, data) {
  const lat = data.lat != null ? Number(data.lat) : null;
  const lng = data.lng != null ? Number(data.lng) : null;
  const status =
    data.status === 'approved' || data.status === 'rejected' || data.status === 'suspended'
      ? data.status
      : 'pending';
  return {
    id,
    ownerUid: String(data.ownerUid || ''),
    accountType: 'shelter',
    shelterName: String(data.shelterName || ''),
    organizationName: String(data.organizationName || ''),
    registrationDetails: String(data.registrationDetails || ''),
    contactPerson: String(data.contactPerson || ''),
    phoneNumber: String(data.phoneNumber || ''),
    publicEmail: String(data.publicEmail || ''),
    addressLine: String(data.addressLine || ''),
    website: String(data.website || ''),
    socialLinks: typeof data.socialLinks === 'object' && data.socialLinks ? data.socialLinks : {},
    description: String(data.description || ''),
    logoUrl: String(data.logoUrl || ''),
    coverPhotoUrl: String(data.coverPhotoUrl || ''),
    lat: lat != null && Number.isFinite(lat) ? lat : 0,
    lng: lng != null && Number.isFinite(lng) ? lng : 0,
    city: String(data.city || ''),
    status,
    submittedAt: data.submittedAt,
    reviewedAt: data.reviewedAt,
    rejectionNote: data.rejectionNote != null ? String(data.rejectionNote) : '',
    reviewNote: data.reviewNote != null ? String(data.reviewNote) : '',
  };
}

/**
 * @param {string} uid
 * @param {(data: import('./shelterTypes').ShelterProfile | null) => void} onNext
 */
export function subscribeShelterProfile(uid, onNext, onError) {
  if (!isFirebaseConfigured() || !uid) {
    onNext(null);
    return () => {};
  }
  const q = query(sheltersCol(), where('ownerUid', '==', uid), orderBy('submittedAt', 'desc'));
  const qSimple = query(sheltersCol(), where('ownerUid', '==', uid));
  let unsub = () => {};
  const attach = (qRef, clientSort) =>
    onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => mapShelterDoc(d.id, d.data()));
        const sorted = clientSort
          ? rows.sort((a, b) => {
              const ta = a?.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
              const tb = b?.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
              return tb - ta;
            })
          : rows;
        onNext(pickPrimaryShelter(sorted));
      },
      (err) => {
        if (qRef === q) {
          unsub();
          unsub = attach(qSimple, true);
          return;
        }
        if (onError) onError(err);
      }
    );
  unsub = attach(q, false);
  return () => unsub();
}

/**
 * @param {(rows: import('./shelterTypes').ShelterProfile[]) => void} onNext
 */
export function subscribeApprovedShelters(onNext) {
  if (!isFirebaseConfigured()) {
    onNext([]);
    return () => {};
  }
  const q = query(sheltersCol(), where('status', '==', 'approved'), orderBy('shelterName', 'asc'));
  return onSnapshot(q, (snap) => onNext(snap.docs.map((d) => mapShelterDoc(d.id, d.data()))), () => onNext([]));
}

export async function fetchPendingShelterApplications() {
  if (!isFirebaseConfigured()) return [];
  const q = query(sheltersCol(), where('status', '==', 'pending'), orderBy('submittedAt', 'asc'));
  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapShelterDoc(d.id, d.data()));
  } catch {
    const snap = await getDocs(query(sheltersCol(), where('status', '==', 'pending')));
    return snap.docs
      .map((d) => mapShelterDoc(d.id, d.data()))
      .sort((a, b) => {
        const ta = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
        const tb = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
        return ta - tb;
      });
  }
}

/**
 * @param {string} uid
 * @param {Partial<import('./shelterTypes').ShelterProfile>} data
 */
export async function saveShelterApplication(uid, data) {
  if (!isFirebaseConfigured()) throw new Error('firebase_unconfigured');
  const ref = doc(sheltersCol());
  const payload = {
    ownerUid: uid,
    accountType: 'shelter',
    shelterName: String(data.shelterName || '').trim().slice(0, 120),
    organizationName: String(data.organizationName || '').trim().slice(0, 120),
    registrationDetails: String(data.registrationDetails || '').trim().slice(0, 500),
    contactPerson: String(data.contactPerson || '').trim().slice(0, 120),
    phoneNumber: String(data.phoneNumber || '').trim().slice(0, 40),
    publicEmail: String(data.publicEmail || '').trim().slice(0, 120),
    addressLine: String(data.addressLine || '').trim().slice(0, 200),
    website: String(data.website || '').trim().slice(0, 200),
    socialLinks: data.socialLinks && typeof data.socialLinks === 'object' ? data.socialLinks : {},
    description: String(data.description || '').trim().slice(0, 4000),
    logoUrl: String(data.logoUrl || '').trim().slice(0, 500),
    coverPhotoUrl: String(data.coverPhotoUrl || '').trim().slice(0, 500),
    lat: Number(data.lat),
    lng: Number(data.lng),
    city: String(data.city || '').trim().slice(0, 80),
    status: 'pending',
    submittedAt: serverTimestamp(),
  };
  if (!payload.shelterName) throw new Error('shelter_name_required');
  if (Number.isNaN(payload.lat) || Number.isNaN(payload.lng)) throw new Error('location_required');
  await setDoc(ref, payload, { merge: true });
  return ref.id;
}

export async function adminApproveShelter(shelterId, note) {
  await updateDoc(shelterDocRef(shelterId), {
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewNote: note ? String(note).slice(0, 500) : '',
  });
}

export async function adminRejectShelter(shelterId, note) {
  await updateDoc(shelterDocRef(shelterId), {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    rejectionNote: String(note || '').slice(0, 500),
  });
}

export async function adminSuspendShelter(shelterId, note) {
  await updateDoc(shelterDocRef(shelterId), {
    status: 'suspended',
    reviewedAt: serverTimestamp(),
    reviewNote: String(note || '').slice(0, 500),
  });
}

export async function adminReactivateShelter(shelterId, note) {
  await updateDoc(shelterDocRef(shelterId), {
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewNote: String(note || '').slice(0, 500),
  });
}

export async function fetchShelterById(shelterId) {
  if (!isFirebaseConfigured() || !shelterId) return null;
  const snap = await getDoc(shelterDocRef(shelterId));
  if (!snap.exists()) return null;
  return mapShelterDoc(snap.id, snap.data());
}

/**
 * @param {string[]} ids
 */
export async function fetchSheltersByIds(ids) {
  if (!isFirebaseConfigured() || !ids?.length) return {};
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 30);
  const q = query(sheltersCol(), where(documentId(), 'in', unique));
  const snap = await getDocs(q);
  const out = Object.fromEntries(unique.map((id) => [id, null]));
  snap.forEach((d) => {
    out[d.id] = mapShelterDoc(d.id, d.data());
  });
  return out;
}

export async function updateShelterProfile(shelterId, uid, patch) {
  const snap = await getDoc(shelterDocRef(shelterId));
  if (!snap.exists() || snap.data()?.ownerUid !== uid) throw new Error('forbidden');
  await updateDoc(shelterDocRef(shelterId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export { COL as SHELTERS_COL, ADMINS };
