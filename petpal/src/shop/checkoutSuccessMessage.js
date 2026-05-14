const PLUS_SKU = 'PETPAL_PLUS_MONTHLY';

/**
 * @param {(k: string, v?: object) => string} t
 * @param {{
 *   focusSku: string | null,
 *   plusBound: string | null,
 *   plusActive: boolean,
 *   collarComboParam: string | null,
 *   collarTotalParam: string | null,
 *   shopStats: { combo: number, total: number },
 * }} p
 */
export function checkoutSuccessMessage(t, p) {
  const { focusSku, plusBound, plusActive, collarComboParam, collarTotalParam, shopStats } = p;
  if (focusSku === PLUS_SKU) {
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

export { PLUS_SKU };
