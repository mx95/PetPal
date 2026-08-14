/**
 * JCC getOrderStatusExtended.do orderStatus values (see gateway docs).
 * 1 = pre-auth hold, 2 = fully authorized/captured, 3 = REVERSED (VERIFY success).
 */

function orderStatusNumber(json) {
  const s = json?.orderStatus;
  const n = typeof s === 'string' ? Number(s) : s;
  return Number.isFinite(n) ? n : null;
}

function paidOrderStatus(json) {
  const n = orderStatusNumber(json);
  return n === 1 || n === 2;
}

/**
 * Zero-amount VERIFY card registration completes as REVERSED (3).
 * @see https://gateway.jcc.com.cy/developer/en/integration/api/scripts.html
 */
function cardVerifyOrderSucceeded(json) {
  if (paidOrderStatus(json)) return true;
  return orderStatusNumber(json) === 3;
}

/**
 * Features for €0 card binding via register.do.
 *
 * Live JCC test gateway results (PetPal-api):
 * - amount=0 + VERIFY → OK
 * - amount=0 + features=VERIFY&features=FORCE_CREATE_BINDING → OK
 * - amount=0 + FORCE_CREATE_BINDING (alone, first, or `;` with VERIFY) → "[amount] is empty"
 *
 * So VERIFY must be first (or alone). Prefer repeated params with VERIFY first.
 */
const CARD_BINDING_FEATURES = ['VERIFY', 'FORCE_CREATE_BINDING'];
/** VERIFY-only €0 registration (still creates a binding when clientId is set). */
const CARD_BINDING_FEATURES_VERIFY_ONLY = 'VERIFY';

module.exports = {
  orderStatusNumber,
  paidOrderStatus,
  cardVerifyOrderSucceeded,
  CARD_BINDING_FEATURES,
  CARD_BINDING_FEATURES_VERIFY_ONLY,
};
