/** @typedef {{ id: string, title: string, subtitle: string, amountCents: number, currency: string, recurring: boolean, badge?: string }} ShopProduct */

/** Mirror functions/shopPricing.js + shop-pricing.json */
export const PLUS_MONTHLY_CENTS = 699;
export const PLUS_YEARLY_CENTS = 8499;
export const TRACKER_ADDON_CENTS = 4000;

export const PLUS_SKUS = ['PETPAL_PLUS_MONTHLY', 'PETPAL_PLUS_YEARLY'];

/** @param {boolean} [includeTracker] */
export function monthlyFirstPaymentCents(includeTracker = false) {
  return PLUS_MONTHLY_CENTS + (includeTracker ? TRACKER_ADDON_CENTS : 0);
}

/**
 * Must match Cloud Function createJccCheckout (shopPricing.js).
 * @param {string} sku
 * @param {boolean} [includeTracker]
 */
export function expectedCheckoutCents(sku, includeTracker = false) {
  if (sku === 'PETPAL_PLUS_MONTHLY') return monthlyFirstPaymentCents(includeTracker);
  if (sku === 'PETPAL_PLUS_YEARLY') return PLUS_YEARLY_CENTS;
  if (sku === 'STORE_BOOST_MONTHLY') return 999;
  return null;
}

/** @type {ShopProduct[]} */
export const SHOP_PRODUCTS = [
  {
    id: 'PETPAL_PLUS_MONTHLY',
    title: 'Monthly',
    subtitle: 'PetPal Plus billed every month. Optionally add a GPS tracker to your first payment.',
    amountCents: PLUS_MONTHLY_CENTS,
    currency: '978',
    recurring: true,
    badge: 'Monthly',
  },
  {
    id: 'PETPAL_PLUS_YEARLY',
    title: 'Yearly',
    subtitle: 'PetPal Plus for 12 months — FREE GPS tracker included with this plan.',
    amountCents: PLUS_YEARLY_CENTS,
    currency: '978',
    recurring: true,
    badge: 'Free tracker',
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
