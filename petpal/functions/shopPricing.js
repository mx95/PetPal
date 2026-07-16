/**
 * Single source of truth for JCC checkout amounts (cents, ISO 4217 EUR = 978).
 * Frontend mirrors these in src/shop/catalog.js — keep in sync.
 */
const PRICES = require('./shop-pricing.json');

const PLUS_MONTHLY_CENTS = PRICES.PLUS_MONTHLY_CENTS;
const PLUS_YEARLY_CENTS = PRICES.PLUS_YEARLY_CENTS;
const PLUS_YEARLY_RENEWAL_CENTS = PRICES.PLUS_YEARLY_RENEWAL_CENTS;
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
  STORE_BOOST_NEARBY_MONTHLY: {
    amountCents: PRICES.STORE_BOOST_NEARBY_MONTHLY_CENTS,
    currency: '978',
    title: 'Nearby map boost (monthly)',
    recurring: true,
  },
  STORE_BOOST_BOOKINGS_MONTHLY: {
    amountCents: PRICES.STORE_BOOST_BOOKINGS_MONTHLY_CENTS,
    currency: '978',
    title: 'Bookings recommended boost (monthly)',
    recurring: true,
  },
};

const PLUS_SKUS = new Set(['PETPAL_PLUS_MONTHLY', 'PETPAL_PLUS_YEARLY']);

/**
 * @param {string} sku
 * @param {{ includeTracker?: boolean, includeNfc?: boolean, nfcPetIds?: string[], nfcPetCount?: number }} [options]
 */
function resolveCheckoutPricing(sku, options = {}) {
  const includeTracker = Boolean(options.includeTracker);
  const nfcPetIds = Array.isArray(options.nfcPetIds) ? options.nfcPetIds : [];
  const nfcPetCount = Math.max(
    0,
    Number.isFinite(options.nfcPetCount)
      ? Number(options.nfcPetCount)
      : nfcPetIds.length || (options.includeNfc ? 1 : 0)
  );
  const catalog = SKUS[sku];
  if (!catalog) return null;

  if (sku === 'PETPAL_PLUS_MONTHLY') {
    let chargeCents = PLUS_MONTHLY_CENTS;
    const parts = ['PetPal Plus (monthly)'];
    if (includeTracker) {
      chargeCents += TRACKER_ADDON_CENTS;
      parts.push('GPS tracker');
    }
    if (nfcPetCount > 0) {
      chargeCents += NFC_TAG_ADDON_CENTS * nfcPetCount;
      parts.push(nfcPetCount === 1 ? 'NFC tag' : `${nfcPetCount} NFC tags`);
    }
    return {
      chargeCents,
      renewalCents: PLUS_MONTHLY_CENTS,
      title: parts.join(' + '),
      includeTracker,
      includeNfc: nfcPetCount > 0,
    };
  }

  if (sku === 'PETPAL_PLUS_YEARLY') {
    return {
      chargeCents: PLUS_YEARLY_CENTS,
      renewalCents: PLUS_YEARLY_RENEWAL_CENTS,
      title: 'PetPal Plus (yearly) + free GPS tracker & NFC tag',
      includeTracker: true,
      includeNfc: true,
    };
  }

  return {
    chargeCents: catalog.amountCents,
    renewalCents: catalog.recurring ? catalog.amountCents : null,
    title: catalog.title,
    includeTracker: false,
    includeNfc: sku === 'NFC_TAG_HARDWARE',
  };
}

function normalizeCartLine(row) {
  const nfcPetIds = Array.isArray(row.nfcPetIds)
    ? row.nfcPetIds.map(String).filter(Boolean).slice(0, 20)
    : undefined;
  const selectedDesignId =
    row.selectedDesignId != null && Number.isFinite(Number(row.selectedDesignId))
      ? Math.max(1, Math.min(999, Number(row.selectedDesignId)))
      : undefined;
  return {
    key: String(row.key || '').slice(0, 120),
    title: String(row.title || 'Item').slice(0, 120),
    subtitle: row.subtitle ? String(row.subtitle).slice(0, 200) : undefined,
    priceCents: Math.max(0, Number(row.priceCents) || 0),
    qty: Math.max(1, Math.min(99, Number(row.qty) || 1)),
    sku: row.sku ? String(row.sku).slice(0, 64) : undefined,
    productId: row.productId ? String(row.productId).slice(0, 64) : undefined,
    saveCard: Boolean(row.saveCard),
    includeTracker: Boolean(row.includeTracker),
    includeNfc: Boolean(row.includeNfc),
    nfcPetIds: nfcPetIds?.length ? nfcPetIds : undefined,
    selectedDesignId,
    trackerImei: row.trackerImei ? String(row.trackerImei).trim().slice(0, 20) : undefined,
    recurring: Boolean(row.recurring),
  };
}

function compactCartLine(row) {
  const line = normalizeCartLine(row);
  return Object.fromEntries(Object.entries(line).filter(([, v]) => v !== undefined));
}

function resolveMarketplaceCartPricing(cartItems) {
  const lines = (cartItems || []).map(compactCartLine).filter((row) => row.key);
  if (!lines.length) return null;
  const chargeCents = lines.reduce((sum, row) => sum + row.priceCents * row.qty, 0);
  if (chargeCents <= 0) return null;
  return {
    chargeCents,
    renewalCents: null,
    title: `PetPal shop order (${lines.length} item${lines.length === 1 ? '' : 's'})`,
    includeTracker: lines.some((row) => row.includeTracker),
    includeNfc: lines.some((row) => row.includeNfc),
    cartItems: lines,
  };
}

function resolveCartLinePricing(line) {
  const sku = line.sku;
  if (!sku || !SKUS[sku]) return Math.max(0, Number(line.priceCents) || 0);
  const nfcPetIds = Array.isArray(line.nfcPetIds) ? line.nfcPetIds : [];
  if (sku === 'NFC_TAG_HARDWARE') {
    return NFC_TAG_ADDON_CENTS * Math.max(1, nfcPetIds.length || line.qty || 1);
  }
  const pricing = resolveCheckoutPricing(sku, {
    includeTracker: line.includeTracker,
    includeNfc: line.includeNfc,
    nfcPetIds,
  });
  return pricing ? pricing.chargeCents : Math.max(0, Number(line.priceCents) || 0);
}

function validateMarketplaceCartLines(lines) {
  for (const line of lines) {
    const sku = line.sku;
    if (!sku || !SKUS[sku]) continue;
    const catalog = SKUS[sku];
    const needsNfcPets =
      (sku === 'PETPAL_PLUS_MONTHLY' && line.includeNfc) ||
      sku === 'PETPAL_PLUS_YEARLY' ||
      sku === 'NFC_TAG_HARDWARE';
    if (needsNfcPets && !(line.nfcPetIds && line.nfcPetIds.length)) {
      return 'Select at least one pet for NFC tag configuration.';
    }
    if (catalog.recurring && !line.saveCard) {
      return 'This plan bills on a schedule — enable “Save card securely” on each subscription in your cart.';
    }
    if (line.includeTracker && !PLUS_SKUS.has(sku)) {
      return 'GPS tracker is only available with PetPal Plus plans.';
    }
    if (sku === 'PETPAL_PLUS_MONTHLY' && line.trackerImei && !/^\d{10,20}$/.test(String(line.trackerImei).trim())) {
      return 'Enter a valid tracker IMEI (10–20 digits).';
    }
    const expectedUnit = resolveCartLinePricing(line);
    if (expectedUnit !== line.priceCents) {
      return 'Cart pricing is out of date — refresh the shop page and add items again.';
    }
  }
  return null;
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
  PLUS_YEARLY_RENEWAL_CENTS,
  resolveCheckoutPricing,
  resolveMarketplaceCartPricing,
  validateMarketplaceCartLines,
  expectedChargeCents,
};
