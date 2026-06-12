/**
 * Single source of truth for JCC checkout amounts (cents, ISO 4217 EUR = 978).
 * Frontend mirrors these in src/shop/catalog.js — keep in sync.
 */
const PRICES = require('./shop-pricing.json');

const PLUS_MONTHLY_CENTS = PRICES.PLUS_MONTHLY_CENTS;
const PLUS_YEARLY_CENTS = PRICES.PLUS_YEARLY_CENTS;
const TRACKER_ADDON_CENTS = PRICES.TRACKER_ADDON_CENTS;
const NFC_TAG_ADDON_CENTS = PRICES.NFC_TAG_ADDON_CENTS;

const SKUS = {
  PETPAL_PLUS_MONTHLY: {
    amountCents: PLUS_MONTHLY_CENTS,
    currency: '978',
    title: 'PetPal Plus (monthly)',
    recurring: true,
  },
  PETPAL_PLUS_YEARLY: {
    amountCents: PLUS_YEARLY_CENTS,
    currency: '978',
    title: 'PetPal Plus (yearly)',
    recurring: true,
  },
  TRACKER_HARDWARE: {
    amountCents: TRACKER_ADDON_CENTS,
    currency: '978',
    title: 'GPS tracker device',
    recurring: false,
  },
  NFC_TAG_HARDWARE: {
    amountCents: NFC_TAG_ADDON_CENTS,
    currency: '978',
    title: 'NFC pet tag',
    recurring: false,
  },
  STORE_BOOST_MONTHLY: {
    amountCents: PRICES.STORE_BOOST_MONTHLY_CENTS,
    currency: '978',
    title: 'Business visibility boost (monthly)',
    recurring: true,
  },
};

const PLUS_SKUS = new Set(['PETPAL_PLUS_MONTHLY', 'PETPAL_PLUS_YEARLY']);

/**
 * @param {string} sku
 * @param {{ includeTracker?: boolean, includeNfc?: boolean }} [options]
 */
function resolveCheckoutPricing(sku, options = {}) {
  const includeTracker = Boolean(options.includeTracker);
  const includeNfc = Boolean(options.includeNfc);
  const catalog = SKUS[sku];
  if (!catalog) return null;

  if (sku === 'PETPAL_PLUS_MONTHLY') {
    let chargeCents = PLUS_MONTHLY_CENTS;
    const parts = ['PetPal Plus (monthly)'];
    if (includeTracker) {
      chargeCents += TRACKER_ADDON_CENTS;
      parts.push('GPS tracker');
    }
    if (includeNfc) {
      chargeCents += NFC_TAG_ADDON_CENTS;
      parts.push('NFC tag');
    }
    return {
      chargeCents,
      renewalCents: PLUS_MONTHLY_CENTS,
      title: parts.join(' + '),
      includeTracker,
      includeNfc,
    };
  }

  return {
    chargeCents: catalog.amountCents,
    renewalCents: catalog.recurring ? catalog.amountCents : null,
    title: catalog.title,
    includeTracker: false,
    includeNfc: false,
  };
}

/**
 * @param {string} sku
 * @param {{ includeTracker?: boolean, includeNfc?: boolean } | boolean} [options]
 */
function expectedChargeCents(sku, options = {}) {
  const normalized =
    typeof options === 'boolean' ? { includeTracker: options } : options || {};
  const p = resolveCheckoutPricing(sku, normalized);
  return p ? p.chargeCents : null;
}

module.exports = {
  PRICES,
  SKUS,
  PLUS_SKUS,
  resolveCheckoutPricing,
  expectedChargeCents,
};
