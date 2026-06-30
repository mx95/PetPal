/** @typedef {{ id: string, title: string, subtitle: string, amountCents: number, currency: string, recurring: boolean, badge?: string }} ShopProduct */

/** Mirror functions/shopPricing.js + shop-pricing.json */
export const PLUS_MONTHLY_CENTS = 499;
export const PLUS_YEARLY_CENTS = 8499;
export const TRACKER_ADDON_CENTS = 3999;
export const NFC_TAG_ADDON_CENTS = 999;

export const PLUS_SKUS = ['PETPAL_PLUS_MONTHLY', 'PETPAL_PLUS_YEARLY'];
export const HARDWARE_SKUS = ['TRACKER_HARDWARE', 'NFC_TAG_HARDWARE'];

/**
 * @param {{ includeTracker?: boolean, includeNfc?: boolean } | boolean} [opts]
 */
export function monthlyFirstPaymentCents(opts = {}) {
  const options = typeof opts === 'boolean' ? { includeTracker: opts } : opts;
  const includeTracker = Boolean(options.includeTracker);
  const includeNfc = Boolean(options.includeNfc);
  return (
    PLUS_MONTHLY_CENTS +
    (includeTracker ? TRACKER_ADDON_CENTS : 0) +
    (includeNfc ? NFC_TAG_ADDON_CENTS : 0)
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
  return null;
}

/** @type {ShopProduct[]} */
export const SHOP_PRODUCTS = [
  {
    id: 'PETPAL_PLUS_MONTHLY',
    title: 'Monthly',
    subtitle:
      'PetPal Plus billed every month per tracker. Optionally add a GPS tracker or NFC tag to your first payment.',
    amountCents: PLUS_MONTHLY_CENTS,
    currency: '978',
    recurring: true,
    badge: 'Monthly',
  },
  {
    id: 'PETPAL_PLUS_YEARLY',
    title: 'Yearly',
    subtitle: 'PetPal Plus for 12 months — FREE GPS tracker and NFC tag included with this plan.',
    amountCents: PLUS_YEARLY_CENTS,
    currency: '978',
    recurring: true,
    badge: 'Free tracker + NFC',
  },
  {
    id: 'TRACKER_HARDWARE',
    title: 'GPS tracker',
    subtitle: 'One GPS tracker device. Live tracking needs PetPal Plus — use monthly plan + tracker add-on.',
    amountCents: TRACKER_ADDON_CENTS,
    currency: '978',
    recurring: false,
    badge: 'Hardware',
  },
  {
    id: 'NFC_TAG_HARDWARE',
    title: 'NFC tag',
    subtitle: 'Tap-to-open pet profile tag — no subscription required to order.',
    amountCents: NFC_TAG_ADDON_CENTS,
    currency: '978',
    recurring: false,
    badge: 'Hardware',
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
  return formatEur(product.amountCents);
}
