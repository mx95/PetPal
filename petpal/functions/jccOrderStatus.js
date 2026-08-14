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

/** Features for €0 card binding via register.do (repeat features= in the form body). */
const CARD_BINDING_FEATURES = ['FORCE_CREATE_BINDING', 'VERIFY'];

module.exports = {
  orderStatusNumber,
  paidOrderStatus,
  cardVerifyOrderSucceeded,
  CARD_BINDING_FEATURES,
};
