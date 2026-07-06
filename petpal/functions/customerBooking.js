const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { sendBookingConfirmationEmails } = require('./bookingEmail');

const GENERATED_SLOT_PREFIX = 'gen_';

function parseGeneratedSlotId(slotId) {
  const raw = String(slotId || '');
  if (!raw.startsWith(GENERATED_SLOT_PREFIX)) return null;
  const body = raw.slice(GENERATED_SLOT_PREFIX.length);
  const sep = body.indexOf('_');
  if (sep <= 0) return null;
  const startMs = Number(body.slice(0, sep));
  const parsedServiceId = body.slice(sep + 1);
  if (!Number.isFinite(startMs) || !parsedServiceId) return null;
  return { startMs, serviceId: parsedServiceId };
}

function resolveDurationMin({ durationMin, serviceSnapshot, variantSnapshot }) {
  const explicit = Number(durationMin);
  if (Number.isFinite(explicit) && explicit >= 5) return Math.round(explicit);
  const fromServiceSnapshot = Number(serviceSnapshot?.durationMin);
  if (Number.isFinite(fromServiceSnapshot) && fromServiceSnapshot >= 5) return Math.round(fromServiceSnapshot);
  const fromVariant = Number(variantSnapshot?.durationMin);
  if (Number.isFinite(fromVariant) && fromVariant >= 5) return Math.round(fromVariant);
  return 30;
}

function fail(code, message) {
  throw new functions.https.HttpsError(code, message);
}

function timestampToDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  return null;
}

async function resolveOpenSlot(db, companyId, serviceId, slotId, durationMin) {
  const generated = parseGeneratedSlotId(slotId);
  if (generated) {
    if (String(generated.serviceId) !== String(serviceId)) fail('failed-precondition', 'slot_not_open');
    const startDate = new Date(generated.startMs);
    const endDate = new Date(generated.startMs + durationMin * 60000);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      fail('failed-precondition', 'slot_not_open');
    }
    return {
      generated: true,
      startAt: admin.firestore.Timestamp.fromDate(startDate),
      endAt: admin.firestore.Timestamp.fromDate(endDate),
    };
  }

  const slotRef = db.doc(`companies/${companyId}/availability/${slotId}`);
  const slotSnap = await slotRef.get();
  if (!slotSnap.exists) fail('failed-precondition', 'slot_not_found');
  const slot = slotSnap.data() || {};
  if (slot.status !== 'open') fail('failed-precondition', 'slot_not_open');
  return {
    generated: false,
    startAt: slot.startAt || null,
    endAt: slot.endAt || null,
    slotRef,
  };
}

exports.createCustomerBooking = functions.region('europe-west1').https.onCall(async (data, context) => {
  const customerUid = context.auth?.uid;
  if (!customerUid) fail('unauthenticated', 'booking_auth_required');

  const companyId = String(data?.companyId || '').trim();
  const serviceId = String(data?.serviceId || '').trim();
  const slotId = String(data?.slotId || '').trim();
  const petId = String(data?.petId || '').trim();
  if (!companyId || !serviceId || !slotId || !petId) fail('invalid-argument', 'missing_fields');

  const petSnapshot = data?.petSnapshot && typeof data.petSnapshot === 'object' ? data.petSnapshot : {};
  const variantId = data?.variantId ? String(data.variantId) : null;
  const variantSnapshot =
    data?.variantSnapshot && typeof data.variantSnapshot === 'object' ? data.variantSnapshot : null;
  const serviceSnapshot =
    data?.serviceSnapshot && typeof data.serviceSnapshot === 'object' ? data.serviceSnapshot : null;
  const durationMin = resolveDurationMin({
    durationMin: data?.durationMin,
    serviceSnapshot,
    variantSnapshot,
  });

  const db = admin.firestore();
  const providerSnap = await db.doc(`providers/${companyId}`).get();
  if (!providerSnap.exists) fail('failed-precondition', 'booking_provider_missing');
  const providerData = providerSnap.data() || {};
  if (providerData.bookingEnabled !== true) fail('failed-precondition', 'booking_not_enabled');

  const resolved = await resolveOpenSlot(db, companyId, serviceId, slotId, durationMin);
  const bookingRef = db.collection('bookings').doc();
  const bookingPayload = {
    companyId,
    serviceId,
    slotId,
    customerUid,
    petId,
    petSnapshot,
    startAt: resolved.startAt,
    endAt: resolved.endAt,
    status: 'booked',
    walkIn: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (variantId) bookingPayload.variantId = variantId;
  if (variantSnapshot) bookingPayload.variantSnapshot = variantSnapshot;
  if (serviceSnapshot) bookingPayload.serviceSnapshot = serviceSnapshot;

  await bookingRef.set(bookingPayload);

  const startDate = timestampToDate(resolved.startAt);
  const endDate = timestampToDate(resolved.endAt);
  try {
    await sendBookingConfirmationEmails({
      db,
      bookingId: bookingRef.id,
      customerUid,
      companyId,
      storeName: String(providerData.displayName || data?.providerName || '').trim(),
      serviceName: String(serviceSnapshot?.name || data?.serviceName || 'Appointment').trim(),
      petName: String(petSnapshot?.name || data?.petName || 'Pet').trim(),
      variantLabel: String(variantSnapshot?.label || '').trim(),
      whenIso: startDate ? startDate.toISOString() : '',
      startAt: startDate,
      endAt: endDate,
      durationMin,
      price: data?.price || variantSnapshot?.price || serviceSnapshot?.price || '',
      address: String(providerData.address || data?.providerAddress || '').trim(),
      addons: Array.isArray(data?.addons) ? data.addons.map(String) : [],
    });
  } catch (err) {
    functions.logger.error('Booking confirmation emails failed after create', err);
  }

  return { bookingId: bookingRef.id };
});
