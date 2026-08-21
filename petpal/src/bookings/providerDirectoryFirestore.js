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
import { isHiddenDemoProvider } from './bookingBrowseUtils';

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
    (snap) =>
      onNext(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => !isHiddenDemoProvider(p))
      ),
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
function providerTypesFromBusinessType(businessType) {
  const t = String(businessType || '').toLowerCase();
  if (t === 'pet_walker') return { vet: false, saloon: false, hotel: false, walker: true, bath: false, shop: false };
  if (t === 'pet_hotel') return { vet: false, saloon: false, hotel: true, walker: false, bath: false, shop: false };
  if (t === 'vet_clinic') return { vet: true, saloon: false, hotel: false, walker: false, bath: false, shop: false };
  if (t === 'pet_shop') return { vet: false, saloon: false, hotel: false, walker: false, bath: false, shop: true };
  return { vet: true, saloon: true, hotel: true, walker: false, shop: false };
}

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
    providerTypes: providerTypesFromBusinessType(companyData.businessType),
  });
}

export async function publishProviderProfile(companyId, patch) {
  if (!isFirebaseConfigured() || !companyId || !patch || typeof patch !== 'object') return;
  const payload = { updatedAt: serverTimestamp() };

  if ('bookingEnabled' in patch) payload.bookingEnabled = patch.bookingEnabled === true;
  if (patch.displayName !== undefined) {
    payload.displayName = String(patch.displayName || '').trim().slice(0, 120);
  }
  if (patch.address !== undefined) payload.address = patch.address ? String(patch.address).trim().slice(0, 200) : '';
  if (patch.phone !== undefined) payload.phone = patch.phone ? String(patch.phone).trim().slice(0, 60) : '';
  if (patch.lat !== undefined) payload.lat = finiteCoordFromPatch(patch.lat);
  if (patch.lng !== undefined) payload.lng = finiteCoordFromPatch(patch.lng);
  if (patch.providerTypes !== undefined && typeof patch.providerTypes === 'object') {
    payload.providerTypes = patch.providerTypes;
  }
  if (patch.workingHours !== undefined) {
    payload.workingHours = patch.workingHours ? String(patch.workingHours).trim().slice(0, 120) : '';
  }
  if (patch.breakHours !== undefined) payload.breakHours = patch.breakHours ? String(patch.breakHours).trim().slice(0, 120) : '';
  if (patch.holidayClosures !== undefined) {
    payload.holidayClosures = patch.holidayClosures ? String(patch.holidayClosures).trim().slice(0, 300) : '';
  }
  if (patch.staffCount !== undefined) {
    payload.staffCount = Number.isFinite(Number(patch.staffCount)) ? Math.max(1, Number(patch.staffCount)) : 1;
  }
  if (patch.slotIntervalMin !== undefined) {
    payload.slotIntervalMin = Number.isFinite(Number(patch.slotIntervalMin)) ? Math.max(5, Number(patch.slotIntervalMin)) : 30;
  }
  if (patch.holidayCountry !== undefined) {
    payload.holidayCountry = patch.holidayCountry ? String(patch.holidayCountry).trim().slice(0, 2).toUpperCase() : 'CY';
  }
  if ('boostNearbyEnabled' in patch || 'boostBookingsEnabled' in patch || 'boostEnabled' in patch) {
    payload.boostEnabled = Boolean(patch?.boostEnabled || patch?.boostNearbyEnabled || patch?.boostBookingsEnabled);
    payload.boostNearbyEnabled = Boolean(patch?.boostNearbyEnabled);
    payload.boostBookingsEnabled = Boolean(patch?.boostBookingsEnabled);
    payload.sponsored = Boolean(patch?.sponsored || patch?.boostNearbyEnabled || patch?.boostEnabled);
    payload.recommended = Boolean(patch?.recommended || patch?.boostBookingsEnabled || patch?.boostEnabled);
  }
  if ('bookingLimitEnabled' in patch || 'bookingLimitPerDay' in patch) {
    if (patch?.bookingLimitEnabled && Number.isFinite(Number(patch?.bookingLimitPerDay))) {
      payload.bookingLimitPerDay = Math.max(1, Number(patch.bookingLimitPerDay));
    } else if ('bookingLimitEnabled' in patch) {
      payload.bookingLimitPerDay = deleteField();
    }
  }

  if (Object.keys(payload).length <= 1) return;
  await setDoc(doc(getDb(), 'providers', companyId), payload, { merge: true });
}

export async function setProviderBookingEnabled(companyId, bookingEnabled) {
  await publishProviderProfile(companyId, { bookingEnabled: bookingEnabled === true });
}

/** Coerce legacy provider rows to a strict boolean for booking checks. */
export function normalizeBookingEnabledFlag(value) {
  return value === true;
}

/**
 * Live booking gate for customer appointments (read before bookSlot commit).
 * @param {string} companyId
 * @returns {Promise<{ exists: boolean, bookingEnabled: boolean, displayName: string }>}
 */
export async function getProviderBookingStatus(companyId) {
  if (!isFirebaseConfigured() || !companyId) {
    return { exists: false, bookingEnabled: false, displayName: '' };
  }
  const snap = await getDoc(doc(getDb(), 'providers', String(companyId)));
  if (!snap.exists()) {
    return { exists: false, bookingEnabled: false, displayName: '' };
  }
  const data = snap.data() || {};
  return {
    exists: true,
    bookingEnabled: normalizeBookingEnabledFlag(data.bookingEnabled),
    displayName: String(data.displayName || '').trim(),
  };
}

