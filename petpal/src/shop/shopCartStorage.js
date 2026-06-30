const CART_KEY = 'petpal_shop_cart';

/** @returns {Array<object>} */
export function readShopCartItems() {
  try {
    const raw = sessionStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {Array<object>} items */
export function writeShopCartItems(items) {
  try {
    sessionStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
}

export function clearShopCartItems() {
  try {
    sessionStorage.removeItem(CART_KEY);
  } catch {
    /* ignore */
  }
}
