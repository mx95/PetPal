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
import { seedProviderListingFromCompany } from '../bookings/providerDirectoryFirestore';
import { getDb, isFirebaseConfigured } from '../firebase';

const COL = 'companies';
const ADMINS = 'admins';

export function companyDocRef(companyId) {
  return doc(getDb(), COL, companyId);
}

export function adminDocRef(uid) {
  return doc(getDb(), ADMINS, uid);
}

function companiesCol() {
  return collection(getDb(), COL);
}

/** @param {import('./companyTypes').CompanyProfile[]} rows */
function pickPrimaryCompany(rows) {
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
 * @param {string} uid
 * @param {(data: import('./companyTypes').CompanyProfile | null) => void} onNext
 * @param {(err: Error) => void} [onError]
 * @returns {() => void}
 */
export function subscribeCompanyProfile(uid, onNext, onError) {
  return subscribeCompanyProfiles(
    uid,
    (rows) => onNext(pickPrimaryCompany(rows)),
    onError
  );
}

/**
 * @param {string} uid
 * @param {(data: import('./companyTypes').CompanyProfile[]) => void} onNext
 * @param {(err: Error) => void} [onError]
 * @returns {() => void}
 */
export function subscribeCompanyProfiles(uid, onNext, onError) {
  if (!isFirebaseConfigured() || !uid) {
    onNext([]);
    return () => {};
  }

  const mapRows = (snap) =>
    snap.docs.map((d) =>
      /** @type {import('./companyTypes').CompanyProfile} */ ({
        id: d.id,
        ...d.data(),
      })
    );

  const sortRows = (rows) =>
    [...rows].sort((a, b) => {
      const ta = a?.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
      const tb = b?.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
      return tb - ta;
    });

  const qOrdered = query(companiesCol(), where('ownerUid', '==', uid), orderBy('submittedAt', 'desc'));
  const qSimple = query(companiesCol(), where('ownerUid', '==', uid));

  let unsub = () => {};
  const attach = (q, clientSort) =>
    onSnapshot(
      q,
      (snap) => onNext(clientSort ? sortRows(mapRows(snap)) : mapRows(snap)),
      (err) => {
        if (q === qOrdered) {
          unsub();
          unsub = attach(qSimple, true);
          return;
        }
        if (onError) onError(err);
      }
    );

  unsub = attach(qOrdered, false);
  return () => unsub();
}

/**
 * @param {string} uid
 * @param {(isAdmin: boolean) => void} onNext
 * @returns {() => void}
 */
export function subscribeIsAdmin(uid, onNext) {
  if (!isFirebaseConfigured() || !uid) {
    onNext(false);
    return () => {};
  }
  return onSnapshot(adminDocRef(uid), (snap) => onNext(snap.exists()));
}

/**
 * @param {string} uid
 * @param {import('./companyTypes').CompanyApplicationInput} data
 */
export async function saveCompanyApplication(uid, data) {
  if (!isFirebaseConfigured()) throw new Error('firebase_unconfigured');
  const ref = doc(companiesCol());
  const payload = {
    ownerUid: uid,
    accountType: 'company',
    businessName: String(data.businessName || '').trim().slice(0, 120),
    businessType: data.businessType ? String(data.businessType).trim().slice(0, 60) : 'other',
    logoUrl: data.logoUrl ? String(data.logoUrl).trim().slice(0, 300) : '',
    addressLine: data.addressLine ? String(data.addressLine).trim().slice(0, 200) : '',
    publicEmail: data.publicEmail ? String(data.publicEmail).trim().slice(0, 120) : '',
    phoneNumber: data.phoneNumber ? String(data.phoneNumber).trim().slice(0, 40) : '',
    workingHours: data.workingHours ? String(data.workingHours).trim().slice(0, 250) : '',
    lat: Number(data.lat),
    lng: Number(data.lng),
    status: 'pending',
    submittedAt: serverTimestamp(),
  };
  if (!payload.businessName) throw new Error('business_name_required');
  if (Number.isNaN(payload.lat) || Number.isNaN(payload.lng)) throw new Error('location_required');
  await setDoc(ref, payload, { merge: true });
}

/**
 * @returns {Promise<import('./companyTypes').CompanyProfile[]>}
 */
export async function fetchPendingCompanyApplications() {
  if (!isFirebaseConfigured()) return [];
  const tryOrdered = query(companiesCol(), where('status', '==', 'pending'), orderBy('submittedAt', 'asc'));
  try {
    const snap = await getDocs(tryOrdered);
    return snap.docs.map((d) => {
      const x = d.data();
      return { id: d.id, ...x };
    });
  } catch {
    const q2 = query(companiesCol(), where('status', '==', 'pending'));
    const snap = await getDocs(q2);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return list.sort((a, b) => {
      const ta = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
      const tb = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
      return ta - tb;
    });
  }
}

/**
 * @param {string} userId
 * @param {string} [note]
 */
export async function adminApproveCompany(userId, note) {
  const ref = companyDocRef(userId);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : null;
  const ownerUid = String(prev?.ownerUid || userId || '');
  await updateDoc(ref, {
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewNote: note ? String(note).slice(0, 500) : '',
  });

  // Keep a stable owner-keyed summary doc for legacy rule checks and existing feature gates.
  if (ownerUid && ownerUid !== userId && prev) {
    await setDoc(
      companyDocRef(ownerUid),
      {
        ...prev,
        ownerUid,
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewNote: note ? String(note).slice(0, 500) : '',
      },
      { merge: true }
    );
  }

  if (prev) {
    try {
      await seedProviderListingFromCompany(ownerUid || userId, prev);
    } catch (e) {
      console.warn('[adminApproveCompany] seedProviderListingFromCompany failed', e);
    }
  }
}

/**
 * @param {string} userId
 * @param {string} [note]
 */
export async function adminRejectCompany(userId, note) {
  await updateDoc(companyDocRef(userId), {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    rejectionNote: String(note || '').slice(0, 500),
  });
}

/**
 * @param {string[]} ids
 * @returns {Promise<Record<string, import('./companyTypes').CompanyProfile | null>>}
 */
export async function fetchCompanyProfilesByIds(ids) {
  if (!isFirebaseConfigured() || !Array.isArray(ids) || ids.length === 0) return {};
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return {};
  const q = query(companiesCol(), where(documentId(), 'in', uniqueIds.slice(0, 30)));
  const snap = await getDocs(q);
  const out = Object.fromEntries(uniqueIds.map((id) => [id, null]));
  snap.forEach((d) => {
    out[d.id] = /** @type {import('./companyTypes').CompanyProfile} */ ({ id: d.id, ...d.data() });
  });
  return out;
}
