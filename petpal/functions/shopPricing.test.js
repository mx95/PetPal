const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateMarketplaceCartLines,
  resolveMarketplaceCartPricing,
  PRICES,
} = require('./shopPricing');

test('standalone TRACKER_HARDWARE cart line is allowed', () => {
  const lines = [
    {
      key: 'tracker-1',
      title: 'GPS tracker',
      priceCents: PRICES.TRACKER_ADDON_CENTS,
      qty: 1,
      sku: 'TRACKER_HARDWARE',
      includeTracker: true,
      includeNfc: false,
      saveCard: false,
    },
  ];
  assert.equal(validateMarketplaceCartLines(lines), null);
  const pricing = resolveMarketplaceCartPricing(lines);
  assert.equal(pricing.chargeCents, PRICES.TRACKER_ADDON_CENTS);
  assert.equal(pricing.includeTracker, true);
});

test('includeTracker on non-Plus / non-tracker SKU is rejected', () => {
  const err = validateMarketplaceCartLines([
    {
      key: 'nfc-1',
      title: 'NFC tag',
      priceCents: PRICES.NFC_TAG_ADDON_CENTS,
      qty: 1,
      sku: 'NFC_TAG_HARDWARE',
      includeTracker: true,
      includeNfc: true,
      nfcPetIds: ['pet1'],
      saveCard: false,
    },
  ]);
  assert.equal(err, 'GPS tracker is only available with PetPal Plus plans.');
});
