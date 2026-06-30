const CHECKOUT_KEY = 'petpal_pending_checkout';

/**
 * @typedef {{
 *   cartItems: Array<object>,
 *   amountCents: number,
 *   payload: { sku: string, saveCard: boolean, cartItems: Array<object> },
 * }} PendingCheckout
 */

/** @param {PendingCheckout} data */
export function savePendingCheckout(data) {
  try {
    sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

/** @returns {PendingCheckout | null} */
export function readPendingCheckout() {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.cartItems) || !data.payload) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearPendingCheckout() {
  try {
    sessionStorage.removeItem(CHECKOUT_KEY);
  } catch {
    /* ignore */
  }
}
