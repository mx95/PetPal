import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

export function normalizeDiscountCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function isValidDiscountCodeFormat(code) {
  return CODE_RE.test(code);
}

/**
 * Preview discount against a subtotal (client-side; server re-validates at checkout).
 * @param {number} subtotalCents
 * @param {{ type: string, amount: number, active?: boolean }} discount
 */
export function computeDiscountedCharge(subtotalCents, discount) {
  const subtotal = Math.max(0, Math.floor(Number(subtotalCents) || 0));
  if (!discount || discount.active === false || subtotal <= 0) return null;

  const type = String(discount.type || '').trim();
  const amount = Number(discount.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  let discountCents = 0;
  if (type === 'percentage') {
    if (amount > 100) return null;
    discountCents = Math.floor((subtotal * amount) / 100);
  } else if (type === 'fixed') {
    discountCents = Math.min(subtotal, Math.floor(amount));
  } else {
    return null;
  }

  discountCents = Math.max(0, Math.min(subtotal, discountCents));
  const chargeCents = subtotal - discountCents <= 0 ? 1 : subtotal - discountCents;
  return { discountCents: subtotal - chargeCents, chargeCents };
}

function mapDiscountDoc(id, data) {
  return {
    id,
    code: String(data.code || id || '').toUpperCase(),
    active: data.active === true,
    type: data.type === 'fixed' ? 'fixed' : 'percentage',
    amount: Math.max(0, Math.floor(Number(data.amount) || 0)),
    note: data.note ? String(data.note) : '',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    createdBy: data.createdBy || null,
  };
}

/**
 * Fetch a single active code for checkout preview (signed-in users).
 * @param {string} rawCode
 */
export async function fetchActiveDiscountCode(rawCode) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured.');
  const code = normalizeDiscountCode(rawCode);
  if (!code || !isValidDiscountCodeFormat(code)) {
    throw new Error('Enter a valid discount code.');
  }
  const snap = await getDoc(doc(getDb(), 'discountCodes', code));
  if (!snap.exists()) throw new Error('This discount code was not found.');
  const row = mapDiscountDoc(snap.id, snap.data() || {});
  if (!row.active) throw new Error('This discount code is not active.');
  if (row.type === 'percentage' && (row.amount < 1 || row.amount > 100)) {
    throw new Error('This discount code is invalid.');
  }
  if (row.type === 'fixed' && row.amount < 1) {
    throw new Error('This discount code is invalid.');
  }
  return row;
}

/** Admin: live list of all discount codes. */
export function subscribeDiscountCodes(onData, onError) {
  if (!isFirebaseConfigured()) {
    onError?.(new Error('Firebase is not configured.'));
    return () => {};
  }
  const q = query(collection(getDb(), 'discountCodes'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapDiscountDoc(d.id, d.data() || {})));
    },
    (err) => onError?.(err)
  );
}

/**
 * Admin: create or overwrite a discount code.
 * Fixed amounts are stored in cents; percentage is 1–100.
 */
export async function saveDiscountCode({ code, type, amount, active, note, createdBy }) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured.');
  const normalized = normalizeDiscountCode(code);
  if (!normalized || !isValidDiscountCodeFormat(normalized)) {
    throw new Error('Code must be 2–32 characters (letters, numbers, _ or -).');
  }
  const discountType = type === 'fixed' ? 'fixed' : 'percentage';
  const value = Math.floor(Number(amount));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Enter a positive discount amount.');
  }
  if (discountType === 'percentage' && (value < 1 || value > 100)) {
    throw new Error('Percentage must be between 1 and 100.');
  }
  if (discountType === 'fixed' && value < 1) {
    throw new Error('Fixed amount must be at least €0.01.');
  }

  const ref = doc(getDb(), 'discountCodes', normalized);
  const existing = await getDoc(ref);
  const payload = {
    code: normalized,
    type: discountType,
    amount: value,
    active: active !== false,
    note: String(note || '').trim().slice(0, 200),
    updatedAt: serverTimestamp(),
  };
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = createdBy || null;
  }
  await setDoc(ref, payload, { merge: true });
  return normalized;
}

export async function setDiscountCodeActive(code, active) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured.');
  const normalized = normalizeDiscountCode(code);
  await updateDoc(doc(getDb(), 'discountCodes', normalized), {
    active: Boolean(active),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDiscountCode(code) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured.');
  const normalized = normalizeDiscountCode(code);
  await deleteDoc(doc(getDb(), 'discountCodes', normalized));
}
