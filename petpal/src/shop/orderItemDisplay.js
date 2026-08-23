/**
 * Resolve NFC design id from an order/cart line.
 * Prefer explicit selectedDesignId; fall back to cart key `…-d{id}-…`.
 * @param {{ selectedDesignId?: number|string, key?: string, productId?: string, sku?: string, includeNfc?: boolean }} item
 * @returns {number|null}
 */
export function nfcDesignIdFromOrderItem(item) {
  if (!item) return null;
  if (item.selectedDesignId != null && Number.isFinite(Number(item.selectedDesignId))) {
    return Math.max(1, Math.min(999, Number(item.selectedDesignId)));
  }
  const key = String(item.key || '');
  const fromKey = key.match(/-d(\d+)(?:-|$)/i);
  if (fromKey) return Math.max(1, Math.min(999, Number(fromKey[1])));
  return null;
}

/**
 * Whether this line is (or includes) an NFC tag that may have a design.
 * @param {{ productId?: string, sku?: string, includeNfc?: boolean, key?: string, selectedDesignId?: number|string }} item
 */
export function orderItemHasNfcDesign(item) {
  if (!item) return false;
  if (item.selectedDesignId != null) return true;
  if (item.productId === 'nfc-tag' || item.sku === 'NFC_TAG_HARDWARE') return true;
  if (item.includeNfc) return true;
  return /(?:^|-)nfc(?:-|$)/i.test(String(item.key || ''));
}
