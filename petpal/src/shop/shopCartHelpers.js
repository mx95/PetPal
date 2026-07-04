import { PLUS_SKUS, BOOST_SKUS, monthlyFirstPaymentCents, formatEur, NFC_TAG_ADDON_CENTS } from './catalog';

/**
 * @typedef {import('./catalog').ShopProduct} ShopProduct
 */

/**
 * @typedef {{
 *   key: string,
 *   title: string,
 *   subtitle?: string,
 *   priceCents: number,
 *   qty: number,
 *   sku?: string,
 *   saveCard?: boolean,
 *   includeTracker?: boolean,
 *   includeNfc?: boolean,
 *   nfcPetIds?: string[],
 *   trackerImei?: string,
 *   recurring?: boolean,
 * }} CartItem
 */

/**
 * @param {ShopProduct} product
 * @param {{
 *   includeTracker?: boolean,
 *   includeNfc?: boolean,
 *   nfcPetIds?: string[],
 *   saveCard?: boolean,
 *   petNames?: string[],
 *   trackerImei?: string,
 * }} opts
 * @returns {CartItem}
 */
export function buildSubscriptionCartItem(product, opts) {
  const includeTracker = Boolean(opts.includeTracker);
  const nfcPetIds = Array.isArray(opts.nfcPetIds) ? opts.nfcPetIds : [];
  const includeNfc = Boolean(opts.includeNfc) && nfcPetIds.length > 0;
  const saveCard = Boolean(opts.saveCard);
  const petNames = Array.isArray(opts.petNames) ? opts.petNames : [];
  const trackerImei = opts.trackerImei ? String(opts.trackerImei).trim() : '';

  let priceCents = product.amountCents;
  let title = product.title;
  const parts = [product.title];

  if (product.id === 'PETPAL_PLUS_MONTHLY') {
    priceCents = monthlyFirstPaymentCents({ includeTracker, nfcPetIds });
    if (trackerImei) parts.push('Existing GPS tracker');
    else if (includeTracker) parts.push('GPS tracker');
    if (includeNfc) {
      parts.push(nfcPetIds.length === 1 ? 'NFC tag' : `${nfcPetIds.length} NFC tags`);
    }
    title = parts.join(' + ');
  } else if (product.id === 'PETPAL_PLUS_YEARLY') {
    title = 'Yearly + free GPS tracker & NFC tag';
  } else if (product.id === 'NFC_TAG_HARDWARE') {
    priceCents = NFC_TAG_ADDON_CENTS * Math.max(1, nfcPetIds.length);
    title = nfcPetIds.length > 1 ? `NFC tag ×${nfcPetIds.length}` : 'NFC tag';
  }

  const yearlyIncludeTracker = product.id === 'PETPAL_PLUS_YEARLY' ? true : includeTracker;
  const yearlyIncludeNfc =
    product.id === 'PETPAL_PLUS_YEARLY' ? true : includeNfc;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const key =
    product.id === 'NFC_TAG_HARDWARE'
      ? `nfc-${nfcPetIds.slice().sort().join('-')}-${suffix}`
      : `sub-${product.id}-${suffix}`;

  /** @type {string | undefined} */
  let subtitle;
  if (includeNfc && petNames.length) {
    subtitle = petNames.join(', ');
  } else if (product.id === 'PETPAL_PLUS_YEARLY' && petNames.length) {
    subtitle = petNames.join(', ');
  }

  return {
    key,
    title,
    subtitle,
    priceCents,
    qty: 1,
    sku: product.id,
    saveCard,
    includeTracker: yearlyIncludeTracker,
    includeNfc: yearlyIncludeNfc,
    nfcPetIds: nfcPetIds.length ? nfcPetIds : undefined,
    trackerImei: trackerImei || undefined,
    recurring: Boolean(product.recurring),
  };
}

/**
 * @param {Array<{ sku?: string, recurring?: boolean, saveCard?: boolean, includeNfc?: boolean, nfcPetIds?: string[] }>} items
 * @param {(key: string) => string} t
 * @returns {string | null}
 */
export function validateCartForCheckout(items, t) {
  for (const row of items) {
    const sku = row.sku || '';
    if ((sku === 'PETPAL_PLUS_MONTHLY' && row.includeNfc) || sku === 'PETPAL_PLUS_YEARLY' || sku === 'NFC_TAG_HARDWARE') {
      if (!row.nfcPetIds?.length) return t('shopPage.nfcSelectPetRequired');
    }
    if (sku === 'PETPAL_PLUS_MONTHLY' && row.trackerImei && !/^\d{10,20}$/.test(String(row.trackerImei).trim())) {
      return t('shopPage.existingImeiInvalid');
    }
    if ((row.recurring || PLUS_SKUS.includes(sku) || BOOST_SKUS.includes(sku)) && !row.saveCard) {
      return t('shopPage.saveCardRequired');
    }
  }
  return null;
}

/** Subscription / NFC lines should not merge quantities — one checkout config per row. */
export function isSubscriptionCartLine(row) {
  const sku = row.sku || '';
  return Boolean(sku && (PLUS_SKUS.includes(sku) || BOOST_SKUS.includes(sku) || sku === 'NFC_TAG_HARDWARE'));
}

/** @param {ReturnType<typeof buildSubscriptionCartItem>} item */
export function subscriptionCartSummary(item) {
  if (!item.subtitle) return formatEur(item.priceCents);
  return `${formatEur(item.priceCents)} · ${item.subtitle}`;
}
