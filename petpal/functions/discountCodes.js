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
function normalizeAppliesToSkus(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const skus = [...new Set(raw.map((s) => String(s || '').trim()).filter(Boolean))];
  return skus.length ? skus : null;
}

/**
 * SKU-scoped codes match the top-level checkout SKU, or any cart line SKU
 * (shop cart checkouts use MARKETPLACE_CART as the outer sku).
 * @param {{ appliesToSkus?: string[]|null }} discount
 * @param {string|{ sku?: string, cartItems?: Array<{ sku?: string }> }} skuOrOptions
 */
function discountAppliesToSku(discount, skuOrOptions) {
  const allowed = discount?.appliesToSkus;
  if (!allowed || !allowed.length) return true;

  if (skuOrOptions && typeof skuOrOptions === 'object' && !Array.isArray(skuOrOptions)) {
    const sku = String(skuOrOptions.sku || '').trim();
    if (sku && allowed.includes(sku)) return true;
    const lines = Array.isArray(skuOrOptions.cartItems) ? skuOrOptions.cartItems : [];
    return lines.some((row) => allowed.includes(String(row?.sku || '').trim()));
  }

  return allowed.includes(String(skuOrOptions || '').trim());
}

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
  const maxUses = Math.max(0, Math.floor(Number(data.maxUses) || 0));
  const usedCount = Math.max(0, Math.floor(Number(data.usedCount) || 0));
  if (maxUses > 0 && usedCount >= maxUses) return null;
  return {
    code,
    type,
    amount: Math.floor(amount),
    active: true,
    appliesToSkus: normalizeAppliesToSkus(data.appliesToSkus),
    maxUses: maxUses || null,
    usedCount,
  };
}

/**
 * Increment usedCount after a successful paid checkout that applied the code.
 * No-op when code is missing; does not re-activate exhausted codes.
 * @param {*} db
 * @param {string} rawCode
 * @param {{ serverTimestamp?: () => unknown }} [fieldValues] Firestore FieldValue helpers
 */
async function recordDiscountCodeUse(db, rawCode, fieldValues = {}) {
  const code = normalizeDiscountCode(rawCode);
  if (!code || !isValidDiscountCodeFormat(code)) return;
  const ref = db.collection('discountCodes').doc(code);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() || {};
    const maxUses = Math.max(0, Math.floor(Number(data.maxUses) || 0));
    const usedCount = Math.max(0, Math.floor(Number(data.usedCount) || 0));
    if (maxUses > 0 && usedCount >= maxUses) return;
    const payload = { usedCount: usedCount + 1 };
    if (typeof fieldValues.serverTimestamp === 'function') {
      payload.updatedAt = fieldValues.serverTimestamp();
    }
    tx.set(ref, payload, { merge: true });
  });
}

/**
 * Apply discount to pricing. Leaves renewalCents unchanged.
 * @param {{ chargeCents: number, renewalCents?: number|null, title?: string }} pricing
 * @param {{ type: string, amount: number, code: string, appliesToSkus?: string[]|null }} discount
 * @param {{ sku?: string, cartItems?: Array<{ sku?: string }> }} [options]
 */
function applyDiscountToPricing(pricing, discount, options = {}) {
  if (!discountAppliesToSku(discount, options)) {
    return { pricing, discountMeta: null };
  }
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
      appliesToSkus: discount.appliesToSkus || null,
    },
  };
}

module.exports = {
  normalizeDiscountCode,
  isValidDiscountCodeFormat,
  computeDiscountedCharge,
  normalizeAppliesToSkus,
  discountAppliesToSku,
  loadActiveDiscountCode,
  recordDiscountCodeUse,
  applyDiscountToPricing,
};
