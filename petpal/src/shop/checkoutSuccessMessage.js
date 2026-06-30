import { PLUS_SKUS } from './catalog';

/**
 * @param {(k: string, v?: object) => string} t
 * @param {{
 *   focusSku: string | null,
 *   plusBound: string | null,
 *   plusActive: boolean,
 *   includeTrackerParam: string | null,
 *   includeNfcParam: string | null,
 *   collarComboParam: string | null,
 *   collarTotalParam: string | null,
 *   shopStats: { combo: number, total: number },
 * }} p
 */
export function checkoutSuccessMessage(t, p) {
  const {
    focusSku,
    plusBound,
    plusActive,
    includeTrackerParam,
    includeNfcParam,
    collarComboParam,
    collarTotalParam,
    shopStats,
  } = p;
  if (focusSku && PLUS_SKUS.includes(focusSku)) {
    if (focusSku === 'PETPAL_PLUS_YEARLY') {
      return t('shopPage.successPlusYearly');
    }
    if (focusSku === 'PETPAL_PLUS_MONTHLY') {
      const hasTracker = includeTrackerParam === '1';
      const hasNfc = includeNfcParam === '1';
      if (hasTracker && hasNfc) return t('shopPage.successPlusMonthlyBoth');
      if (hasTracker) return t('shopPage.successPlusMonthlyTracker');
      if (hasNfc) return t('shopPage.successPlusMonthlyNfc');
    }
    if (plusBound === '1' || (plusBound !== '0' && plusActive)) {
      return t('shopPage.successPlusActive');
    }
    return t('shopPage.successPlusPending');
  }
  if (focusSku === 'TRACKER_HARDWARE') {
    const comboRaw = collarComboParam != null && collarComboParam !== '' ? Number(collarComboParam) : shopStats.combo;
    const totalRaw = collarTotalParam != null && collarTotalParam !== '' ? Number(collarTotalParam) : shopStats.total;
    const combo = Number.isFinite(comboRaw) ? comboRaw : shopStats.combo;
    const total = Number.isFinite(totalRaw) ? totalRaw : shopStats.total;
    return t('shopPage.successCollar', { combo, total });
  }
  if (focusSku === 'MARKETPLACE_CART') {
    return t('shopPage.successMarketplace');
  }
  if (focusSku === 'NFC_TAG_HARDWARE') {
    return t('shopPage.successNfc');
  }
  if (focusSku === 'STORE_BOOST_MONTHLY') {
    return t('shopPage.successBoost');
  }
  return t('shopPage.successGeneric');
}

export { PLUS_SKUS };
