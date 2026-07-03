import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

function companyServicesCol(companyId) {
  return collection(getDb(), 'companies', companyId, 'services');
}

function companyAvailabilityCol(companyId) {
  return collection(getDb(), 'companies', companyId, 'availability');
}

function bookingsCol() {
  return collection(getDb(), 'bookings');
}

function tsToMillis(v) {
  try {
    if (v && typeof v.toMillis === 'function') return v.toMillis();
  } catch {
    // ignore
  }
  return null;
}

export function subscribeCompanyServices(companyId, onNext, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onNext([]);
    return () => {};
  }
  const q = query(companyServicesCol(companyId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      onNext(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    },
    (err) => (onError ? onError(err) : undefined)
  );
}

export async function upsertCompanyService(companyId, serviceId, data) {
  if (!isFirebaseConfigured() || !companyId) return;
  const payload = {
    type: String(data?.type || 'vet'),
    name: String(data?.name || '').trim().slice(0, 120),
    durationMin: Number(data?.durationMin || 30),
    price: data?.price ? String(data.price).trim().slice(0, 40) : '',
    addOns: data?.addOns ? String(data.addOns).trim().slice(0, 500) : '',
    preparationNotes: data?.preparationNotes ? String(data.preparationNotes).trim().slice(0, 800) : '',
    description: data?.description ? String(data.description).slice(0, 800) : '',
    active: data?.active !== false,
    updatedAt: serverTimestamp(),
  };
  if (Array.isArray(data?.variants)) {
    payload.variants = data.variants
      .filter((v) => v && v.id)
      .map((v) => ({
        id: String(v.id).slice(0, 40),
        labelKey: v.labelKey ? String(v.labelKey).slice(0, 80) : '',
        durationMin: Number(v.durationMin) || payload.durationMin,
        price: v.price ? String(v.price).slice(0, 40) : '',
        descriptionKey: v.descriptionKey ? String(v.descriptionKey).slice(0, 80) : '',
      }));
  }
  if (!payload.name) throw new Error('service_name_required');
  if (!Number.isFinite(payload.durationMin) || payload.durationMin < 5) throw new Error('invalid_duration');

  const ref = serviceId
    ? doc(getDb(), 'companies', companyId, 'services', serviceId)
    : doc(companyServicesCol(companyId));
  if (!serviceId) payload.createdAt = serverTimestamp();
  await updateDoc(ref, payload).catch(async () => {
    // updateDoc fails for new doc; fallback to set via batch
    const batch = writeBatch(getDb());
    batch.set(ref, payload, { merge: true });
    await batch.commit();
  });
  return ref.id;
}

export function subscribeCompanyAvailability(companyId, onNext, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onNext([]);
    return () => {};
  }
  const q = query(companyAvailabilityCol(companyId), orderBy('startAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      onNext(
        snap.docs.map((d) => {
          const x = d.data() || {};
          return {
            id: d.id,
            ...x,
            startAtMs: tsToMillis(x.startAt),
            endAtMs: tsToMillis(x.endAt),
          };
        })
      );
    },
    (err) => (onError ? onError(err) : undefined)
  );
}

export async function createAvailabilitySlot(companyId, slot) {
  if (!isFirebaseConfigured() || !companyId) return;
  const startAt = slot?.startAt instanceof Date ? slot.startAt : new Date(String(slot?.startAt || ''));
  const endAt = slot?.endAt instanceof Date ? slot.endAt : new Date(String(slot?.endAt || ''));
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    throw new Error('invalid_time_range');
  }
  const payload = {
    serviceId: String(slot?.serviceId || ''),
    startAt: Timestamp.fromDate(startAt),
    endAt: Timestamp.fromDate(endAt),
    capacity: 1,
    status: String(slot?.status || 'open'),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (!payload.serviceId) throw new Error('missing_service');
  const refDoc = await addDoc(companyAvailabilityCol(companyId), payload);
  return refDoc.id;
}

export async function setSlotStatus(companyId, slotId, status) {
  if (!isFirebaseConfigured() || !companyId || !slotId) return;
  await updateDoc(doc(getDb(), 'companies', companyId, 'availability', slotId), {
    status: String(status || 'blocked'),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeProviderBookings(companyId, onNext, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onNext([]);
    return () => {};
  }
  const q = query(bookingsCol(), where('companyId', '==', companyId), orderBy('startAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => (onError ? onError(err) : undefined)
  );
}

export function subscribeCustomerBookings(uid, onNext, onError) {
  if (!isFirebaseConfigured() || !uid) {
    onNext([]);
    return () => {};
  }
  const q = query(bookingsCol(), where('customerUid', '==', uid), orderBy('startAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => (onError ? onError(err) : undefined)
  );
}

/** Admin-only: live feed of recent bookings across all customers and providers. */
export function subscribeAllBookings(onNext, onError) {
  if (!isFirebaseConfigured()) {
    onNext([]);
    return () => {};
  }
  const q = query(bookingsCol(), orderBy('startAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => (onError ? onError(err) : undefined)
  );
}

export async function updateBookingStatus(bookingId, patch) {
  if (!isFirebaseConfigured() || !bookingId) return;
  await updateDoc(doc(getDb(), 'bookings', bookingId), { ...patch, updatedAt: serverTimestamp() });
}

export async function fetchOpenSlots(companyId, serviceId, { after = new Date() } = {}) {
  if (!isFirebaseConfigured() || !companyId || !serviceId) return [];
  const q = query(
    companyAvailabilityCol(companyId),
    where('serviceId', '==', serviceId),
    where('status', '==', 'open'),
    where('startAt', '>=', Timestamp.fromDate(after)),
    orderBy('startAt', 'asc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchCompanyService(companyId, serviceId) {
  if (!isFirebaseConfigured() || !companyId || !serviceId) return null;
  const snap = await getDoc(doc(getDb(), 'companies', companyId, 'services', serviceId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function swapBookingSlot({ companyId, bookingId, newSlotId }) {
  if (!isFirebaseConfigured()) throw new Error('firebase_unconfigured');
  if (!companyId || !bookingId || !newSlotId) throw new Error('missing_fields');

  const bookingRef = doc(getDb(), 'bookings', bookingId);
  const bookingSnap = await getDoc(bookingRef);
  if (!bookingSnap.exists()) throw new Error('booking_not_found');
  const booking = bookingSnap.data() || {};
  if (String(booking.companyId) !== String(companyId)) throw new Error('forbidden');

  const newSlotRef = doc(getDb(), 'companies', companyId, 'availability', newSlotId);
  const newSlotSnap = await getDoc(newSlotRef);
  if (!newSlotSnap.exists()) throw new Error('slot_not_found');
  const newSlot = newSlotSnap.data() || {};
  if (newSlot.status !== 'open') throw new Error('slot_not_open');

  const batch = writeBatch(getDb());
  const oldSlotId = booking.slotId ? String(booking.slotId) : '';
  if (oldSlotId) {
    batch.update(doc(getDb(), 'companies', companyId, 'availability', oldSlotId), {
      status: 'open',
      updatedAt: serverTimestamp(),
      bookingId: null,
    });
  }
  batch.update(newSlotRef, {
    status: 'blocked',
    updatedAt: serverTimestamp(),
    bookedAt: serverTimestamp(),
    bookingId,
  });
  batch.update(bookingRef, {
    slotId: newSlotId,
    startAt: newSlot.startAt || null,
    endAt: newSlot.endAt || null,
    status: 'booked',
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function blockSlotsForTimeOff(companyId, slotIds) {
  if (!isFirebaseConfigured() || !companyId) return;
  const ids = Array.isArray(slotIds) ? slotIds.filter(Boolean) : [];
  if (!ids.length) return;
  const batch = writeBatch(getDb());
  ids.forEach((slotId) => {
    batch.update(doc(getDb(), 'companies', companyId, 'availability', slotId), {
      status: 'blocked',
      blockReason: 'time_off',
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/** Provider books an open slot for a walk-in / client without a PetPal account. */
export async function createProviderBooking({
  companyId,
  providerUid,
  serviceId,
  slotId,
  clientPetId = null,
  petSnapshot = {},
  ownerName = '',
  ownerPhone = '',
  serviceSnapshot = null,
  notes = '',
}) {
  if (!isFirebaseConfigured()) throw new Error('firebase_unconfigured');
  if (!companyId || !providerUid || !serviceId || !slotId) throw new Error('missing_fields');

  const petName = String(petSnapshot?.name || '').trim();
  if (!petName) throw new Error('pet_name_required');

  const slotRef = doc(getDb(), 'companies', companyId, 'availability', slotId);
  const slotSnap = await getDoc(slotRef);
  if (!slotSnap.exists()) throw new Error('slot_not_found');
  const slot = slotSnap.data() || {};
  if (slot.status !== 'open') throw new Error('slot_not_open');

  const walkInKey = clientPetId ? String(clientPetId) : `manual_${Date.now()}`;
  const customerUid = `walkin:${companyId}:${walkInKey}`;
  const petId = clientPetId ? String(clientPetId) : `walkin_${walkInKey}`;

  const bookingPayload = {
    companyId,
    serviceId,
    slotId,
    customerUid,
    petId,
    petSnapshot: {
      ...petSnapshot,
      name: petName,
      ownerName: ownerName ? String(ownerName).trim().slice(0, 120) : '',
      ownerPhone: ownerPhone ? String(ownerPhone).trim().slice(0, 40) : '',
    },
    startAt: slot.startAt || null,
    endAt: slot.endAt || null,
    status: 'booked',
    walkIn: true,
    bookedByProviderUid: String(providerUid),
    notes: notes ? String(notes).trim().slice(0, 500) : '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (serviceSnapshot) bookingPayload.serviceSnapshot = serviceSnapshot;

  const batch = writeBatch(getDb());
  const bookingRef = doc(bookingsCol());
  batch.set(bookingRef, bookingPayload);
  batch.update(slotRef, {
    status: 'blocked',
    updatedAt: serverTimestamp(),
    bookedAt: serverTimestamp(),
    bookingId: bookingRef.id,
  });
  await batch.commit();

  return bookingRef.id;
}

export async function bookSlot({
  companyId,
  serviceId,
  slotId,
  customerUid,
  petId,
  petSnapshot,
  variantId = null,
  variantSnapshot = null,
  serviceSnapshot = null,
}) {
  if (!isFirebaseConfigured()) throw new Error('firebase_unconfigured');
  if (!companyId || !serviceId || !slotId || !customerUid || !petId) throw new Error('missing_fields');

  const slotRef = doc(getDb(), 'companies', companyId, 'availability', slotId);
  const slotSnap = await getDoc(slotRef);
  if (!slotSnap.exists()) throw new Error('slot_not_found');
  const slot = slotSnap.data() || {};
  if (slot.status !== 'open') throw new Error('slot_not_open');

  const bookingPayload = {
    companyId,
    serviceId,
    slotId,
    customerUid,
    petId,
    petSnapshot: petSnapshot || {},
    startAt: slot.startAt || null,
    endAt: slot.endAt || null,
    status: 'booked',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (variantId) bookingPayload.variantId = String(variantId);
  if (variantSnapshot) bookingPayload.variantSnapshot = variantSnapshot;
  if (serviceSnapshot) bookingPayload.serviceSnapshot = serviceSnapshot;

  // Best-effort: mark slot blocked to prevent double-booking. In v1 this is client-side.
  const batch = writeBatch(getDb());
  const bookingRef = doc(bookingsCol());
  batch.set(bookingRef, bookingPayload);
  batch.update(slotRef, { status: 'blocked', updatedAt: serverTimestamp(), bookedAt: serverTimestamp(), bookingId: bookingRef.id });
  await batch.commit();

  return bookingRef.id;
}

