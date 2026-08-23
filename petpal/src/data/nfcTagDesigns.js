/**
 * @typedef {{ id: number, name: string, image: string, enabled?: boolean }} NfcTagDesign
 */

/** Default NFC catalog — overridden by adminConfig/shopAssets when published. */
export const DEFAULT_NFC_TAG_DESIGNS = [
  { id: 1, name: 'Classic Paw', image: '/images/nfc-tags/nfc-tag-01.png' },
  { id: 2, name: 'Bone White', image: '/images/nfc-tags/nfc-tag-02.png' },
  { id: 3, name: 'Charlie Blue', image: '/images/nfc-tags/nfc-tag-03.png' },
  { id: 5, name: 'Rocky Gold', image: '/images/nfc-tags/nfc-tag-05.png' },
  { id: 6, name: 'Daisy Crown', image: '/images/nfc-tags/nfc-tag-06.png' },
  { id: 7, name: 'Milo Heart', image: '/images/nfc-tags/nfc-tag-07.png' },
  { id: 12, name: 'Zoey Pink', image: '/images/nfc-tags/nfc-tag-12.png' },
  { id: 13, name: 'Emergency Scan', image: '/images/nfc-tags/nfc-tag-13.png' },
  { id: 15, name: 'Lucy White', image: '/images/nfc-tags/nfc-tag-15.png' },
];

/** @deprecated use DEFAULT_NFC_TAG_DESIGNS or useShopAssets */
export const NFC_TAG_DESIGNS = DEFAULT_NFC_TAG_DESIGNS;

/**
 * Merge Firestore shop asset overrides onto defaults.
 * @param {{ nfcDesigns?: Array<{ id: number|string, name?: string, image?: string, enabled?: boolean }> } | null | undefined} assets
 * @returns {NfcTagDesign[]}
 */
export function mergeNfcTagDesigns(assets) {
  const overrides = Array.isArray(assets?.nfcDesigns) ? assets.nfcDesigns : null;
  if (!overrides?.length) {
    return DEFAULT_NFC_TAG_DESIGNS.map((d) => ({ ...d, enabled: true }));
  }

  return overrides
    .map((row) => ({
      id: Number(row.id),
      name: String(row.name || `Design ${row.id}`).slice(0, 80),
      image: String(row.image || '').slice(0, 500),
      enabled: row.enabled !== false,
    }))
    .filter((d) => Number.isFinite(d.id) && d.id >= 1 && d.enabled !== false && d.image)
    .sort((a, b) => a.id - b.id);
}

/** @param {number} id @param {NfcTagDesign[]} [catalog] */
export function getNfcTagDesignById(id, catalog = DEFAULT_NFC_TAG_DESIGNS) {
  const list = catalog?.length ? catalog : DEFAULT_NFC_TAG_DESIGNS;
  return list.find((d) => d.id === Number(id)) || list[0];
}

export const DEFAULT_TRACKER_SHOP_IMAGE = '/images/shop/gps-tracker-v2.png';

/** @param {{ trackerImage?: string } | null | undefined} assets */
export function resolveTrackerShopImage(assets) {
  const url = String(assets?.trackerImage || '').trim();
  return url || DEFAULT_TRACKER_SHOP_IMAGE;
}
