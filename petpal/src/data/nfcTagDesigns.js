/**
 * @typedef {{ id: number, name: string, image: string }} NfcTagDesign
 */

/** @type {NfcTagDesign[]} */
export const NFC_TAG_DESIGNS = [
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

/** @param {number} id */
export function getNfcTagDesignById(id) {
  return NFC_TAG_DESIGNS.find((d) => d.id === Number(id)) || NFC_TAG_DESIGNS[0];
}
