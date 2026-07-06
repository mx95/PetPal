/** @typedef {{ id: string, title: string, subtitle: string, amountCents: number, currency: string, recurring: boolean, badge?: string }} ShopProduct */

/** Mirror functions/shopPricing.js + shop-pricing.json */
export const PLUS_MONTHLY_CENTS = 499;
export const PLUS_YEARLY_CENTS = 8999;
export const PLUS_YEARLY_RENEWAL_CENTS = 5999;
export const TRACKER_ADDON_CENTS = 3999;
export const NFC_TAG_ADDON_CENTS = 999;

export const PLUS_SKUS = ['PETPAL_PLUS_MONTHLY', 'PETPAL_PLUS_YEARLY'];
export const HARDWARE_SKUS = ['TRACKER_HARDWARE', 'NFC_TAG_HARDWARE'];
export const BOOST_SKUS = [
  'STORE_BOOST_NEARBY_MONTHLY',
  'STORE_BOOST_BOOKINGS_MONTHLY',
  'STORE_BOOST_MONTHLY',
];

/**
 * @param {{ includeTracker?: boolean, includeNfc?: boolean, nfcPetIds?: string[], nfcPetCount?: number } | boolean} [opts]
 */
export function monthlyFirstPaymentCents(opts = {}) {
  const options = typeof opts === 'boolean' ? { includeTracker: opts } : opts;
  const includeTracker = Boolean(options.includeTracker);
  const nfcPetCount = Math.max(
    0,
    Number.isFinite(options.nfcPetCount)
      ? Number(options.nfcPetCount)
      : Array.isArray(options.nfcPetIds)
        ? options.nfcPetIds.length
        : options.includeNfc
          ? 1
          : 0
  );
  return (
    PLUS_MONTHLY_CENTS +
    (includeTracker ? TRACKER_ADDON_CENTS : 0) +
    (nfcPetCount > 0 ? NFC_TAG_ADDON_CENTS * nfcPetCount : 0)
  );
}

/**
 * Must match Cloud Function createJccCheckout (shopPricing.js).
 * @param {string} sku
 * @param {{ includeTracker?: boolean, includeNfc?: boolean } | boolean} [opts]
 */
export function expectedCheckoutCents(sku, opts = {}) {
  const options = typeof opts === 'boolean' ? { includeTracker: opts } : opts;
  if (sku === 'PETPAL_PLUS_MONTHLY') return monthlyFirstPaymentCents(options);
  if (sku === 'PETPAL_PLUS_YEARLY') return PLUS_YEARLY_CENTS;
  if (sku === 'TRACKER_HARDWARE') return TRACKER_ADDON_CENTS;
  if (sku === 'NFC_TAG_HARDWARE') return NFC_TAG_ADDON_CENTS;
  if (sku === 'STORE_BOOST_MONTHLY') return 999;
  if (sku === 'STORE_BOOST_NEARBY_MONTHLY') return 299;
  if (sku === 'STORE_BOOST_BOOKINGS_MONTHLY') return 399;
  if (sku === 'MARKETPLACE_CART' && Array.isArray(options.cartItems)) {
    return marketplaceCartTotalCents(options.cartItems);
  }
  return null;
}

/** @param {Array<{ priceCents: number, qty: number }>} items */
export function marketplaceCartTotalCents(items) {
  return (items || []).reduce(
    (sum, row) => sum + Math.max(0, Number(row.priceCents) || 0) * Math.max(1, Number(row.qty) || 1),
    0
  );
}

/** @type {ShopProduct[]} */
export const SHOP_PRODUCTS = [
  {
    id: 'PETPAL_PLUS_MONTHLY',
    title: 'Monthly',
    subtitle: '',
    amountCents: PLUS_MONTHLY_CENTS,
    currency: '978',
    recurring: true,
    badge: 'Monthly',
  },
  {
    id: 'PETPAL_PLUS_YEARLY',
    title: 'Yearly',
    subtitle: '',
    amountCents: PLUS_YEARLY_CENTS,
    currency: '978',
    recurring: true,
    badge: 'Free tracker + NFC',
  },
  {
    id: 'NFC_TAG_HARDWARE',
    title: 'NFC tag',
    subtitle: 'Tap-to-open pet profile tag for your pet.',
    amountCents: NFC_TAG_ADDON_CENTS,
    currency: '978',
    recurring: false,
    badge: 'Hardware',
  },
];

/** Business-only visibility boosts (approved company accounts). */
export const BUSINESS_BOOST_PRODUCTS = [
  {
    id: 'STORE_BOOST_NEARBY_MONTHLY',
    title: 'Nearby boost',
    subtitle: 'Appear first on the Nearby map strip when pet parents browse local businesses.',
    amountCents: 299,
    currency: '978',
    recurring: true,
    badge: 'Business',
  },
  {
    id: 'STORE_BOOST_BOOKINGS_MONTHLY',
    title: 'Bookings boost',
    subtitle: 'Get recommended at the top of the Bookings hub in your area.',
    amountCents: 399,
    currency: '978',
    recurring: true,
    badge: 'Business',
  },
];

export function formatEur(amountCents) {
  const n = amountCents / 100;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);
}

/** @param {ShopProduct} product */
export function formatShopPrice(product) {
  if (product.id === 'PETPAL_PLUS_MONTHLY') return `${formatEur(product.amountCents)}/mo`;
  if (product.id === 'PETPAL_PLUS_YEARLY') return `${formatEur(product.amountCents)}/year`;
  if (BOOST_SKUS.includes(product.id)) return `${formatEur(product.amountCents)}/mo`;
  return formatEur(product.amountCents);
}
