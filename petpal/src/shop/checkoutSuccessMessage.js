import { PLUS_SKUS } from './catalog';

/**
 * @param {(k: string, v?: object) => string} t
 * @param {{
 *   focusSku: string | null,
 *   plusBound: string | null,
 *   plusActive: boolean,
 *   includeTrackerParam: string | null,
 *   collarComboParam: string | null,
 *   collarTotalParam: string | null,
 *   shopStats: { combo: number, total: number },
 * }} p
 */
export function checkoutSuccessMessage(t, p) {
  const { focusSku, plusBound, plusActive, includeTrackerParam, collarComboParam, collarTotalParam, shopStats } = p;
  if (focusSku && PLUS_SKUS.includes(focusSku)) {
    if (focusSku === 'PETPAL_PLUS_YEARLY') {
      return t('shopPage.successPlusYearly');
    }
    if (focusSku === 'PETPAL_PLUS_MONTHLY' && includeTrackerParam === '1') {
      return t('shopPage.successPlusMonthlyTracker');
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
  if (focusSku === 'STORE_BOOST_MONTHLY') {
    return t('shopPage.successBoost');
  }
  return t('shopPage.successGeneric');
}

export { PLUS_SKUS };
