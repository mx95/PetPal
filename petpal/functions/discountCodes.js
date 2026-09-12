/**
 * Server-side discount code resolution for JCC checkout.
 * Collection: discountCodes/{CODE} (doc id = uppercase code).
 */

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

function normalizeDiscountCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function isValidDiscountCodeFormat(code) {
  return CODE_RE.test(code);
}

/**
 * @param {number} subtotalCents
 * @param {{ type: string, amount: number, active?: boolean }} discount
 * @returns {{ discountCents: number, chargeCents: number } | null}
 */
function computeDiscountedCharge(subtotalCents, discount) {
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
  // JCC rejects zero-amount orders — keep at least 1 cent when there was a charge.
  const chargeCents = subtotal - discountCents <= 0 ? 1 : subtotal - discountCents;
  return { discountCents: subtotal - chargeCents, chargeCents };
}

/**
 * Load an active discount code from Firestore (Admin SDK).
 * @param {*} db
 * @param {string} rawCode
 */
async function loadActiveDiscountCode(db, rawCode) {
  const code = normalizeDiscountCode(rawCode);
  if (!code || !isValidDiscountCodeFormat(code)) return null;
  const snap = await db.collection('discountCodes').doc(code).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (data.active !== true) return null;
  const type = String(data.type || '').trim();
  const amount = Number(data.amount);
  if ((type !== 'percentage' && type !== 'fixed') || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  if (type === 'percentage' && (amount > 100 || amount < 1)) return null;
  return {
    code,
    type,
    amount: Math.floor(amount),
    active: true,
  };
}

/**
 * Apply discount to pricing. Leaves renewalCents unchanged.
 * @param {{ chargeCents: number, renewalCents?: number|null, title?: string }} pricing
 * @param {{ type: string, amount: number, code: string }} discount
 */
function applyDiscountToPricing(pricing, discount) {
  const applied = computeDiscountedCharge(pricing.chargeCents, discount);
  if (!applied) {
    return { pricing, discountMeta: null };
  }
  const subtotalCents = pricing.chargeCents;
  return {
    pricing: {
      ...pricing,
      chargeCents: applied.chargeCents,
      title: pricing.title ? `${pricing.title} (−${discount.code})` : pricing.title,
    },
    discountMeta: {
      code: discount.code,
      type: discount.type,
      amount: discount.amount,
      subtotalCents,
      discountCents: applied.discountCents,
    },
  };
}

module.exports = {
  normalizeDiscountCode,
  isValidDiscountCodeFormat,
  computeDiscountedCharge,
  loadActiveDiscountCode,
  applyDiscountToPricing,
};
