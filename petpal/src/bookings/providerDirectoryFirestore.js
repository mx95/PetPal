import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

function providersCol() {
  return collection(getDb(), 'providers');
}

/** @param {unknown} v */
function finiteCoordFromPatch(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function subscribeProviders(onNext, onError) {
  if (!isFirebaseConfigured()) {
    onNext([]);
    return () => {};
  }
  const q = query(providersCol(), where('bookingEnabled', '==', true), orderBy('displayName', 'asc'));
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => (onError ? onError(err) : undefined)
  );
}

export function subscribeProviderProfile(companyId, onNext, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onNext(null);
    return () => {};
  }
  return onSnapshot(
    doc(getDb(), 'providers', companyId),
    (snap) => onNext(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => (onError ? onError(err) : undefined)
  );
}

/**
 * After a company is approved, create `providers/<companyId>` once from the company application
 * so the portal listing card has sensible defaults (listing stays off until they enable bookings).
 *
 * @param {string} companyId
 * @param {Record<string, unknown>} companyData companies/{companyId} fields before status flip
 */
export async function seedProviderListingFromCompany(companyId, companyData) {
  if (!isFirebaseConfigured() || !companyId || !companyData || typeof companyData !== 'object') return;
  const pRef = doc(getDb(), 'providers', companyId);
  const existing = await getDoc(pRef);
  if (existing.exists()) return;
  const displayName = String(companyData.businessName || '').trim().slice(0, 120) || 'Business';
  await publishProviderProfile(companyId, {
    bookingEnabled: false,
    displayName,
    address: String(companyData.addressLine || '').trim().slice(0, 200),
    phone: String(companyData.publicEmail || '').trim().slice(0, 60),
    lat: finiteCoordFromPatch(companyData.lat),
    lng: finiteCoordFromPatch(companyData.lng),
    providerTypes: { vet: true, saloon: true, hotel: true, shop: false },
  });
}

export async function publishProviderProfile(companyId, patch) {
  if (!isFirebaseConfigured() || !companyId) return;
  const payload = {
    bookingEnabled: Boolean(patch?.bookingEnabled),
    displayName: String(patch?.displayName || '').trim().slice(0, 120),
    address: patch?.address ? String(patch.address).trim().slice(0, 200) : '',
    phone: patch?.phone ? String(patch.phone).trim().slice(0, 60) : '',
    lat: finiteCoordFromPatch(patch?.lat),
    lng: finiteCoordFromPatch(patch?.lng),
    providerTypes: patch?.providerTypes && typeof patch.providerTypes === 'object' ? patch.providerTypes : {},
    workingHours: patch?.workingHours ? String(patch.workingHours).trim().slice(0, 120) : '',
    breakHours: patch?.breakHours ? String(patch.breakHours).trim().slice(0, 120) : '',
    holidayClosures: patch?.holidayClosures ? String(patch.holidayClosures).trim().slice(0, 300) : '',
    staffCount: Number.isFinite(Number(patch?.staffCount)) ? Math.max(1, Number(patch.staffCount)) : 1,
    slotIntervalMin: Number.isFinite(Number(patch?.slotIntervalMin)) ? Math.max(5, Number(patch.slotIntervalMin)) : 30,
    holidayCountry: patch?.holidayCountry ? String(patch.holidayCountry).trim().slice(0, 2).toUpperCase() : 'CY',
    boostEnabled: Boolean(patch?.boostEnabled || patch?.boostNearbyEnabled || patch?.boostBookingsEnabled),
    boostNearbyEnabled: Boolean(patch?.boostNearbyEnabled),
    boostBookingsEnabled: Boolean(patch?.boostBookingsEnabled),
    sponsored: Boolean(patch?.sponsored || patch?.boostNearbyEnabled || patch?.boostEnabled),
    recommended: Boolean(patch?.recommended || patch?.boostBookingsEnabled || patch?.boostEnabled),
    updatedAt: serverTimestamp(),
  };
  if (patch?.bookingLimitEnabled && Number.isFinite(Number(patch?.bookingLimitPerDay))) {
    payload.bookingLimitPerDay = Math.max(1, Number(patch.bookingLimitPerDay));
  } else {
    payload.bookingLimitPerDay = deleteField();
  }
  await setDoc(doc(getDb(), 'providers', companyId), payload, { merge: true });
}

