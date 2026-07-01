/**
 * Minimal JCC register.do customer fields (see https://gateway.jcc.com.cy/developer/).
 * Only email + mobilePhone beyond the required register.do params.
 */

function normalizeJccPhone(raw) {
  return String(raw || '')
    .replace(/[^\d+]/g, '')
    .replace(/^00/, '+')
    .slice(0, 15);
}

/**
 * @param {{ email?: string, phone?: string }} shipping
 * @returns {Record<string, string>}
 */
function buildJccRegisterCustomerParams(shipping) {
  /** @type {Record<string, string>} */
  const params = {};
  const email = String(shipping?.email || '').trim().slice(0, 40);
  const mobilePhone = normalizeJccPhone(shipping?.phone);
  if (email) params.email = email;
  if (mobilePhone.length >= 7) params.mobilePhone = mobilePhone;
  return params;
}

/**
 * @param {string} frontendUrl
 * @returns {string}
 */
function buildJccJsonParams(frontendUrl) {
  const base = String(frontendUrl || '').replace(/\/$/, '');
  return JSON.stringify({
    backToShopUrl: `${base}/shop`,
    backToShopName: 'Back to PetPal',
  });
}

module.exports = { buildJccRegisterCustomerParams, buildJccJsonParams };
