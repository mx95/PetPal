/** @typedef {{ id: string, title: string, subtitle: string, amountCents: number, currency: string, recurring: boolean, badge?: string }} ShopProduct */

/** @type {ShopProduct[]} */
export const SHOP_PRODUCTS = [
  {
    id: 'PETPAL_PLUS_MONTHLY',
    title: 'PetPal Plus',
    subtitle: 'Premium walks, insights, and perks — billed monthly. Card is tokenized by JCC for renewals.',
    amountCents: 499,
    currency: '978',
    recurring: true,
    badge: 'Subscription',
  },
  {
    id: 'TRACKER_HARDWARE',
    title: 'GPS tracker collar',
    subtitle: 'Hardware shipped after payment confirmation (fulfilment handled separately).',
    amountCents: 7900,
    currency: '978',
    recurring: false,
    badge: 'One-time',
  },
  {
    id: 'STORE_BOOST_MONTHLY',
    title: 'Business boost',
    subtitle: 'Show your clinic or shop as Recommended in PetPal bookings and on Nearby for ~30 days per renewal.',
    amountCents: 999,
    currency: '978',
    recurring: true,
    badge: 'For businesses',
  },
];

export function formatEur(amountCents) {
  const n = amountCents / 100;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(n);
}
