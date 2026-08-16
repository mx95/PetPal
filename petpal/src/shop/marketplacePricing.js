/**
 * Marketplace commission + linked merchant/listed prices.
 * Self-ship → 10%; PetPal default handling → 12%.
 * Listed prices round to the nearest €0.05.
 */

export const COMMISSION_DEFAULT = 0.12;
export const COMMISSION_SELF_SHIP = 0.1;
export const PETPAL_SELLER_NAME = 'PetPal';

/** Round money (cents) to the nearest €0.05. */
export function roundToNearestFiveCents(cents) {
  const n = Math.max(0, Math.round(Number(cents) || 0));
  return Math.round(n / 5) * 5;
}

export function commissionRateForSelfShip(selfShip) {
  return selfShip ? COMMISSION_SELF_SHIP : COMMISSION_DEFAULT;
}

export function commissionPercentLabel(rate) {
  const pct = Math.round((Number(rate) || 0) * 1000) / 10;
  return Number.isInteger(pct) ? String(pct) : String(pct);
}

/** Merchant keep → customer listed price. */
export function listedFromMerchant(merchantCents, rate) {
  const r = Number(rate);
  const m = Math.max(0, Math.round(Number(merchantCents) || 0));
  if (!(r > 0) || r >= 1) return roundToNearestFiveCents(m);
  return roundToNearestFiveCents(m / (1 - r));
}

/** Customer listed price → merchant keep. */
export function merchantFromListed(listedCents, rate) {
  const r = Number(rate);
  const listed = Math.max(0, Math.round(Number(listedCents) || 0));
  if (!(r > 0) || r >= 1) return roundToNearestFiveCents(listed);
  return roundToNearestFiveCents(listed * (1 - r));
}

export function formatEurFromCents(cents) {
  const n = Math.max(0, Number(cents) || 0) / 100;
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n);
}

/**
 * @param {{ merchantPriceCents: number, listedPriceCents: number, selfShip?: boolean, lastEdited?: 'merchant'|'listed' }} input
 */
export function syncLinkedPrices({ merchantPriceCents, listedPriceCents, selfShip = false, lastEdited = 'merchant' }) {
  const rate = commissionRateForSelfShip(selfShip);
  if (lastEdited === 'listed') {
    const listed = roundToNearestFiveCents(listedPriceCents);
    const merchant = merchantFromListed(listed, rate);
    return {
      rate,
      merchantPriceCents: merchant,
      listedPriceCents: listed,
      commissionCents: Math.max(0, listed - merchant),
    };
  }
  const merchant = roundToNearestFiveCents(merchantPriceCents);
  const listed = listedFromMerchant(merchant, rate);
  return {
    rate,
    merchantPriceCents: merchant,
    listedPriceCents: listed,
    commissionCents: Math.max(0, listed - merchant),
  };
}
