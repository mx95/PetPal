import {
  collection,
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
    lat: typeof companyData.lat === 'number' ? companyData.lat : null,
    lng: typeof companyData.lng === 'number' ? companyData.lng : null,
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
    lat: typeof patch?.lat === 'number' ? patch.lat : null,
    lng: typeof patch?.lng === 'number' ? patch.lng : null,
    providerTypes: patch?.providerTypes && typeof patch.providerTypes === 'object' ? patch.providerTypes : {},
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(getDb(), 'providers', companyId), payload, { merge: true });
}

