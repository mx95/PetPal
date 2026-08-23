import { nfcDesignIdFromOrderItem, orderItemHasNfcDesign } from './orderItemDisplay';

describe('orderItemDisplay', () => {
  it('reads selectedDesignId when present', () => {
    expect(nfcDesignIdFromOrderItem({ selectedDesignId: 12 })).toBe(12);
  });

  it('parses design id from cart key', () => {
    expect(
      nfcDesignIdFromOrderItem({
        key: 'nfc-pet123-d7-abc',
        productId: 'nfc-tag',
      })
    ).toBe(7);
  });

  it('detects NFC lines', () => {
    expect(orderItemHasNfcDesign({ productId: 'nfc-tag' })).toBe(true);
    expect(orderItemHasNfcDesign({ sku: 'NFC_TAG_HARDWARE' })).toBe(true);
    expect(orderItemHasNfcDesign({ includeNfc: true })).toBe(true);
    expect(orderItemHasNfcDesign({ key: 'nfc-x-d1-y' })).toBe(true);
    expect(orderItemHasNfcDesign({ title: 'Boost', sku: 'BOOST_WEEK' })).toBe(false);
  });
});
