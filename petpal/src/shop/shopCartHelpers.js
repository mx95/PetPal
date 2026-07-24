import {
  PLUS_SKUS,
  BOOST_SKUS,
  SHOP_PRODUCTS,
  BUSINESS_BOOST_PRODUCTS,
  monthlyFirstPaymentCents,
  formatEur,
  NFC_TAG_ADDON_CENTS,
  localizeShopProduct,
  translateShopCopy,
} from './catalog';

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
 *   selectedDesignId?: number,
 *   trackerImei?: string,
 *   recurring?: boolean,
 *   productId?: string,
 * }} CartItem
 */

/**
 * @param {ShopProduct} product
 * @param {{
 *   includeTracker?: boolean,
 *   includeNfc?: boolean,
 *   nfcPetIds?: string[],
 *   selectedDesignId?: number,
 *   saveCard?: boolean,
 *   petNames?: string[],
 *   trackerImei?: string,
 *   t?: (key: string, params?: object) => string,
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
  const selectedDesignId =
    includeNfc && opts.selectedDesignId != null ? Number(opts.selectedDesignId) : undefined;

  let priceCents = product.amountCents;
  let title = product.title;

  if (product.id === 'PETPAL_PLUS_MONTHLY') {
    priceCents = monthlyFirstPaymentCents({ includeTracker, nfcPetIds });
  } else if (product.id === 'PETPAL_PLUS_YEARLY') {
    title = 'Yearly + free GPS tracker & NFC tag';
  } else if (product.id === 'TRACKER_HARDWARE') {
    title = 'GPS tracker';
  } else if (product.id === 'NFC_TAG_HARDWARE') {
    priceCents = NFC_TAG_ADDON_CENTS * Math.max(1, nfcPetIds.length);
    title = nfcPetIds.length > 1 ? `NFC tag ×${nfcPetIds.length}` : 'NFC tag';
  }

  const yearlyIncludeTracker =
    product.id === 'PETPAL_PLUS_YEARLY' || product.id === 'TRACKER_HARDWARE' ? true : includeTracker;
  const yearlyIncludeNfc =
    product.id === 'PETPAL_PLUS_YEARLY' ? true : includeNfc;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const key =
    product.id === 'NFC_TAG_HARDWARE'
      ? `nfc-${nfcPetIds.slice().sort().join('-')}-d${selectedDesignId || 1}-${suffix}`
      : product.id === 'TRACKER_HARDWARE'
        ? `tracker-${suffix}`
        : `sub-${product.id}-${suffix}`;

  /** @type {string | undefined} */
  let subtitle;
  if (includeNfc && petNames.length) {
    subtitle = petNames.join(', ');
  } else if (product.id === 'PETPAL_PLUS_YEARLY' && petNames.length) {
    subtitle = petNames.join(', ');
  }

  const item = {
    key,
    title,
    subtitle,
    priceCents,
    qty: 1,
    sku: product.id,
    productId: product.id === 'NFC_TAG_HARDWARE' ? 'nfc-tag' : product.id,
    saveCard,
    includeTracker: yearlyIncludeTracker,
    includeNfc: yearlyIncludeNfc,
    nfcPetIds: nfcPetIds.length ? nfcPetIds : undefined,
    selectedDesignId: selectedDesignId || undefined,
    trackerImei: trackerImei || undefined,
    recurring: Boolean(product.recurring),
  };
  return { ...item, title: localizeCartItemTitle(item, opts.t) };
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
  return Boolean(
    sku &&
      (PLUS_SKUS.includes(sku) ||
        BOOST_SKUS.includes(sku) ||
        sku === 'NFC_TAG_HARDWARE' ||
        sku === 'TRACKER_HARDWARE')
  );
}

function productForSku(sku) {
  return [...SHOP_PRODUCTS, ...BUSINESS_BOOST_PRODUCTS].find((product) => product.id === sku) || null;
}

function localizedProductTitle(sku, t, fallback) {
  const product = productForSku(sku);
  return product ? localizeShopProduct(product, t).title : fallback;
}

function nfcTagLabel(count, t) {
  const n = Math.max(1, Number(count) || 1);
  if (n > 1) {
    return translateShopCopy(t, 'shopPage.cartLines.nfcTagCount', { count: n }, `NFC tag ×${n}`);
  }
  return translateShopCopy(t, 'shopPage.cartLines.nfcTag', undefined, 'NFC tag');
}

export function localizeCartItemTitle(item, t) {
  const sku = item.sku || '';
  if (sku === 'PETPAL_PLUS_MONTHLY') {
    const title = localizedProductTitle(sku, t, item.title || 'Monthly');
    const parts = [title];
    if (item.trackerImei) {
      parts.push(translateShopCopy(t, 'shopPage.cartLines.existingGpsTracker', undefined, 'Existing GPS tracker'));
    } else if (item.includeTracker) {
      parts.push(translateShopCopy(t, 'shopPage.cartLines.gpsTracker', undefined, 'GPS tracker'));
    }
    if (item.includeNfc) {
      parts.push(nfcTagLabel(item.nfcPetIds?.length || 1, t));
    }
    const joiner = translateShopCopy(t, 'shopPage.cartLines.joiner', undefined, ' + ');
    return parts.join(joiner);
  }
  if (sku === 'PETPAL_PLUS_YEARLY') {
    return translateShopCopy(
      t,
      'shopPage.cartLines.yearlyWithHardware',
      undefined,
      item.title || 'Yearly + free GPS tracker & NFC tag'
    );
  }
  if (sku === 'TRACKER_HARDWARE') {
    return localizedProductTitle(sku, t, item.title || 'GPS tracker');
  }
  if (sku === 'NFC_TAG_HARDWARE') {
    return nfcTagLabel(item.nfcPetIds?.length || 1, t);
  }
  if (BOOST_SKUS.includes(sku)) {
    return localizedProductTitle(sku, t, item.title);
  }
  return item.title;
}

export function localizeCartItem(item, t) {
  if (!isSubscriptionCartLine(item)) return item;
  return { ...item, title: localizeCartItemTitle(item, t) };
}

/** @param {ReturnType<typeof buildSubscriptionCartItem>} item */
export function subscriptionCartSummary(item) {
  if (!item.subtitle) return formatEur(item.priceCents);
  return `${formatEur(item.priceCents)} · ${item.subtitle}`;
}
