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
import { auth, getDb, getFirebaseApp, isFirebaseConfigured } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { computeAvailableSlots, slotToFirestoreShape } from './availability/availabilityEngine';
import { parseGeneratedSlotId, resolveGeneratedSlotTimes } from './availability/slotId';
import {
  fetchBookingsInRange,
  fetchSchedulingSettings,
  loadSchedulingContext,
} from './availability/availabilityFirestore';
import { getProviderBookingStatus } from './providerDirectoryFirestore';

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

function withTimeout(promise, ms, code = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(code)), ms);
    }),
  ]);
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

  const ref = serviceId
    ? doc(getDb(), 'companies', companyId, 'services', serviceId)
    : doc(companyServicesCol(companyId));

  if (serviceId) {
    const payload = { updatedAt: serverTimestamp() };
    if (data?.type !== undefined) payload.type = String(data.type || 'vet');
    if (data?.name !== undefined) payload.name = String(data.name || '').trim().slice(0, 120);
    if (data?.durationMin !== undefined) {
      payload.durationMin = Number(data.durationMin || 30);
      if (!Number.isFinite(payload.durationMin) || payload.durationMin < 5) throw new Error('invalid_duration');
    }
    if (data?.price !== undefined) payload.price = data.price ? String(data.price).trim().slice(0, 40) : '';
    if (data?.addOns !== undefined) payload.addOns = data.addOns ? String(data.addOns).trim().slice(0, 500) : '';
    if (data?.preparationNotes !== undefined) {
      payload.preparationNotes = data.preparationNotes ? String(data.preparationNotes).trim().slice(0, 800) : '';
    }
    if (data?.description !== undefined) payload.description = data.description ? String(data.description).slice(0, 800) : '';
    if (data?.active !== undefined) payload.active = data.active !== false;
    if (Array.isArray(data?.variants)) {
      payload.variants = data.variants
        .filter((v) => v && v.id)
        .map((v) => ({
          id: String(v.id).slice(0, 40),
          labelKey: v.labelKey ? String(v.labelKey).slice(0, 80) : '',
          durationMin: Number(v.durationMin) || payload.durationMin || 30,
          price: v.price ? String(v.price).slice(0, 40) : '',
          descriptionKey: v.descriptionKey ? String(v.descriptionKey).slice(0, 80) : '',
        }));
    }
    await updateDoc(ref, payload);
    return serviceId;
  }

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
    createdAt: serverTimestamp(),
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

  await updateDoc(ref, payload).catch(async () => {
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

/**
 * Create many availability slots in batched writes (Firestore limit 500 per batch).
 * @param {string} companyId
 * @param {Array<{ serviceId: string, startAt: Date, endAt: Date, status?: string }>} slots
 * @returns {Promise<number>} count created
 */
export async function bulkCreateAvailabilitySlots(companyId, slots) {
  if (!isFirebaseConfigured() || !companyId || !Array.isArray(slots) || !slots.length) return 0;
  const col = companyAvailabilityCol(companyId);
  let created = 0;
  for (let i = 0; i < slots.length; i += 450) {
    const chunk = slots.slice(i, i + 450);
    const batch = writeBatch(getDb());
    let batchCount = 0;
    chunk.forEach((slot) => {
      const startAt = slot?.startAt instanceof Date ? slot.startAt : new Date(String(slot?.startAt || ''));
      const endAt = slot?.endAt instanceof Date ? slot.endAt : new Date(String(slot?.endAt || ''));
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) return;
      const serviceId = String(slot?.serviceId || '');
      if (!serviceId) return;
      const ref = doc(col);
      batch.set(ref, {
        serviceId,
        startAt: Timestamp.fromDate(startAt),
        endAt: Timestamp.fromDate(endAt),
        capacity: 1,
        status: String(slot?.status || 'open'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batchCount += 1;
    });
    if (batchCount > 0) {
      await batch.commit();
      created += batchCount;
    }
  }
  return created;
}

export async function setSlotStatus(companyId, slotId, status) {
  if (!isFirebaseConfigured() || !companyId || !slotId) return;
  await updateDoc(doc(getDb(), 'companies', companyId, 'availability', slotId), {
    status: String(status || 'blocked'),
    updatedAt: serverTimestamp(),
  });
}

function mapBookingDoc(d) {
  const x = d.data() || {};
  return {
    id: d.id,
    ...x,
    startAtMs: tsToMillis(x.startAt),
    endAtMs: tsToMillis(x.endAt),
  };
}

export async function fetchCustomerBooking(bookingId) {
  if (!isFirebaseConfigured() || !bookingId) return null;
  const snap = await getDoc(doc(getDb(), 'bookings', String(bookingId)));
  if (!snap.exists()) return null;
  const x = snap.data() || {};
  return {
    id: snap.id,
    ...x,
    startAtMs: tsToMillis(x.startAt),
    endAtMs: tsToMillis(x.endAt),
  };
}

export function subscribeProviderBookings(companyId, onNext, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onNext([]);
    return () => {};
  }

  const sortBookings = (rows) =>
    [...rows].sort((a, b) => {
      const ta = a.startAtMs ?? tsToMillis(a.startAt) ?? 0;
      const tb = b.startAtMs ?? tsToMillis(b.startAt) ?? 0;
      return tb - ta;
    });

  const qOrdered = query(bookingsCol(), where('companyId', '==', companyId), orderBy('startAt', 'desc'), limit(100));
  const qSimple = query(bookingsCol(), where('companyId', '==', companyId), limit(100));

  let unsub = () => {};
  const attach = (q, clientSort) =>
    onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map(mapBookingDoc);
        onNext(clientSort ? sortBookings(rows).slice(0, 100) : rows);
      },
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

export function subscribeCustomerBookings(uid, onNext, onError) {
  if (!isFirebaseConfigured() || !uid) {
    onNext([]);
    return () => {};
  }

  const sortBookings = (rows) =>
    [...rows].sort((a, b) => {
      const ta = a.startAtMs ?? tsToMillis(a.startAt) ?? 0;
      const tb = b.startAtMs ?? tsToMillis(b.startAt) ?? 0;
      return tb - ta;
    });

  const qOrdered = query(bookingsCol(), where('customerUid', '==', uid), orderBy('startAt', 'desc'), limit(100));
  const qSimple = query(bookingsCol(), where('customerUid', '==', uid), limit(100));

  let unsub = () => {};
  const attach = (q, clientSort) =>
    onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map(mapBookingDoc);
        onNext(clientSort ? sortBookings(rows).slice(0, 100) : rows);
      },
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

export async function fetchOpenSlots(
  companyId,
  serviceId,
  { after = new Date(), durationMin = null, employeeId = null, rangeDays = 21, timeoutMs = 15000 } = {}
) {
  if (!isFirebaseConfigured() || !companyId || !serviceId) return [];

  const load = async () => {
    const settings = await fetchSchedulingSettings(companyId);
    const horizonDays = Math.min(
      Math.max(1, Number(rangeDays) || 21),
      Math.min(settings.maxBookingDaysAhead || 90, 90)
    );
    const rangeEnd = new Date(after.getTime() + horizonDays * 86400000);

    if (settings.useRuleEngine !== false) {
      try {
        const ctx = await loadSchedulingContext(companyId);
        if (ctx.rules.length) {
          const service = await fetchCompanyService(companyId, serviceId);
          const bookings = await fetchBookingsInRange(companyId, after, rangeEnd);
          const slots = computeAvailableSlots({
            settings,
            service,
            serviceId,
            employeeId,
            durationMin,
            rules: ctx.rules,
            overrides: ctx.overrides,
            vacations: ctx.vacations,
            blockedPeriods: ctx.blockedPeriods,
            bookings,
            rangeStart: after,
            rangeEnd,
          });
          return slots.slice(0, 50).map(slotToFirestoreShape);
        }
      } catch {
        /* fall through to legacy slots */
      }
    }

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
  };

  return withTimeout(load(), timeoutMs, 'slots_timeout');
}

export async function fetchCompanyService(companyId, serviceId) {
  if (!isFirebaseConfigured() || !companyId || !serviceId) return null;
  const snap = await getDoc(doc(getDb(), 'companies', companyId, 'services', serviceId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function resolveOpenSlot(companyId, serviceId, slotId, { durationMin = null } = {}) {
  const generated = resolveGeneratedSlotTimes(slotId, durationMin);
  if (generated) {
    if (String(generated.serviceId) !== String(serviceId)) throw new Error('slot_not_open');
    return {
      generated: true,
      startAt: Timestamp.fromDate(generated.start),
      endAt: Timestamp.fromDate(generated.end),
    };
  }

  const slotRef = doc(getDb(), 'companies', companyId, 'availability', slotId);
  const slotSnap = await getDoc(slotRef);
  if (!slotSnap.exists()) throw new Error('slot_not_found');
  const slot = slotSnap.data() || {};
  if (slot.status !== 'open') throw new Error('slot_not_open');
  return { generated: false, startAt: slot.startAt || null, endAt: slot.endAt || null, slotRef };
}

export async function swapBookingSlot({ companyId, bookingId, newSlotId }) {
  if (!isFirebaseConfigured()) throw new Error('firebase_unconfigured');
  if (!companyId || !bookingId || !newSlotId) throw new Error('missing_fields');

  const bookingRef = doc(getDb(), 'bookings', bookingId);
  const bookingSnap = await getDoc(bookingRef);
  if (!bookingSnap.exists()) throw new Error('booking_not_found');
  const booking = bookingSnap.data() || {};
  if (String(booking.companyId) !== String(companyId)) throw new Error('forbidden');

  const serviceId = String(booking.serviceId || '');
  const durationMin = booking.serviceSnapshot?.durationMin || booking.variantSnapshot?.durationMin || null;
  const newSlot = await resolveOpenSlot(companyId, serviceId, newSlotId, { durationMin });

  const batch = writeBatch(getDb());
  const oldSlotId = booking.slotId ? String(booking.slotId) : '';
  if (oldSlotId && !parseGeneratedSlotId(oldSlotId)) {
    batch.update(doc(getDb(), 'companies', companyId, 'availability', oldSlotId), {
      status: 'open',
      updatedAt: serverTimestamp(),
      bookingId: null,
    });
  }
  if (!newSlot.generated && newSlot.slotRef) {
    batch.update(newSlot.slotRef, {
      status: 'blocked',
      updatedAt: serverTimestamp(),
      bookedAt: serverTimestamp(),
      bookingId,
    });
  }
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

  const durationMin = serviceSnapshot?.durationMin || null;
  const slot = await resolveOpenSlot(companyId, serviceId, slotId, { durationMin });

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
  if (!slot.generated && slot.slotRef) {
    batch.update(slot.slotRef, {
      status: 'blocked',
      updatedAt: serverTimestamp(),
      bookedAt: serverTimestamp(),
      bookingId: bookingRef.id,
    });
  }
  await batch.commit();

  return bookingRef.id;
}

function resolveBookingDurationMin({ durationMin = null, serviceSnapshot = null, variantSnapshot = null, service = null } = {}) {
  const explicit = Number(durationMin);
  if (Number.isFinite(explicit) && explicit >= 5) return Math.round(explicit);
  const fromServiceSnapshot = Number(serviceSnapshot?.durationMin);
  if (Number.isFinite(fromServiceSnapshot) && fromServiceSnapshot >= 5) return Math.round(fromServiceSnapshot);
  const fromVariant = Number(variantSnapshot?.durationMin);
  if (Number.isFinite(fromVariant) && fromVariant >= 5) return Math.round(fromVariant);
  const fromService = Number(service?.durationMin);
  if (Number.isFinite(fromService) && fromService >= 5) return Math.round(fromService);
  return 30;
}

function mapCallableBookingError(e) {
  const code = String(e?.code || '');
  const msg = String(e?.message || '');
  if (code === 'functions/unauthenticated') return new Error('booking_auth_required');
  if (msg === 'booking_not_enabled') return new Error('booking_not_enabled');
  if (msg === 'booking_provider_missing') return new Error('booking_provider_missing');
  if (msg === 'slot_not_open') return new Error('slot_not_open');
  if (msg === 'slot_not_found') return new Error('slot_not_found');
  if (msg === 'missing_fields') return new Error('missing_fields');
  if (code === 'functions/permission-denied') return new Error('booking_permission_denied');
  return new Error(msg || 'booking_permission_denied');
}

async function createCustomerBookingViaFunction({
  companyId,
  serviceId,
  slotId,
  petId,
  petSnapshot,
  variantId,
  variantSnapshot,
  serviceSnapshot,
  durationMin,
}) {
  const app = getFirebaseApp();
  if (!app) throw new Error('firebase_unconfigured');
  const region = process.env.REACT_APP_FUNCTIONS_REGION || 'europe-west1';
  const fn = httpsCallable(getFunctions(app, region), 'createCustomerBooking');
  try {
    const res = await fn({
      companyId: String(companyId),
      serviceId: String(serviceId),
      slotId: String(slotId),
      petId: String(petId),
      petSnapshot: petSnapshot || {},
      variantId: variantId || null,
      variantSnapshot: variantSnapshot || null,
      serviceSnapshot: serviceSnapshot || null,
      durationMin,
    });
    const bookingId = res?.data?.bookingId;
    if (!bookingId) throw new Error('booking_permission_denied');
    return String(bookingId);
  } catch (e) {
    throw mapCallableBookingError(e);
  }
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
  durationMin = null,
  forCustomer = false,
}) {
  if (!isFirebaseConfigured()) throw new Error('firebase_unconfigured');
  if (!companyId || !serviceId || !slotId || !customerUid || !petId) throw new Error('missing_fields');

  const authUid = auth?.currentUser?.uid || null;
  if (!authUid) throw new Error('booking_auth_required');
  if (String(customerUid) !== String(authUid)) throw new Error('booking_auth_mismatch');
  try {
    await auth.currentUser.getIdToken(true);
  } catch {
    /* continue with cached token */
  }

  const service = serviceSnapshot || (await fetchCompanyService(companyId, serviceId));
  const resolvedDurationMin = resolveBookingDurationMin({
    durationMin,
    serviceSnapshot,
    variantSnapshot,
    service,
  });
  const resolved = await resolveOpenSlot(companyId, serviceId, slotId, { durationMin: resolvedDurationMin });
  const slotStart = resolved.startAt;
  const slotEnd = resolved.endAt;

  const listing = await getProviderBookingStatus(companyId);
  if (!listing.exists) throw new Error('booking_provider_missing');
  if (!listing.bookingEnabled) throw new Error('booking_not_enabled');

  if (forCustomer) {
    return createCustomerBookingViaFunction({
      companyId,
      serviceId,
      slotId,
      petId,
      petSnapshot,
      variantId,
      variantSnapshot,
      serviceSnapshot,
      durationMin: resolvedDurationMin,
    });
  }

  const bookingPayload = {
    companyId: String(companyId),
    serviceId: String(serviceId),
    slotId: String(slotId),
    customerUid: authUid,
    petId: String(petId),
    petSnapshot: petSnapshot || {},
    startAt: slotStart,
    endAt: slotEnd,
    status: 'booked',
    walkIn: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (variantId) bookingPayload.variantId = String(variantId);
  if (variantSnapshot) bookingPayload.variantSnapshot = variantSnapshot;
  if (serviceSnapshot) bookingPayload.serviceSnapshot = serviceSnapshot;

  const batch = writeBatch(getDb());
  const bookingRef = doc(bookingsCol());
  batch.set(bookingRef, bookingPayload);
  const shouldBlockLegacySlot = !forCustomer && !resolved.generated && resolved.slotRef;
  if (shouldBlockLegacySlot) {
    batch.update(resolved.slotRef, {
      status: 'blocked',
      updatedAt: serverTimestamp(),
      bookedAt: serverTimestamp(),
      bookingId: bookingRef.id,
    });
  }
  try {
    await batch.commit();
  } catch (e) {
    const code = String(e?.code || '');
    if (code === 'permission-denied') {
      const latest = await getProviderBookingStatus(companyId).catch(() => listing);
      if (!latest.bookingEnabled) throw new Error('booking_not_enabled');
      if (String(authUid) === String(companyId)) throw new Error('booking_self_account');
      throw new Error('booking_permission_denied');
    }
    throw e;
  }

  return bookingRef.id;
}

