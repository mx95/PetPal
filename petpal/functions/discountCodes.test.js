const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeDiscountCode,
  isValidDiscountCodeFormat,
  computeDiscountedCharge,
  discountAppliesToSku,
  applyDiscountToPricing,
} = require('./discountCodes');

test('normalizes and validates codes', () => {
  assert.equal(normalizeDiscountCode('  save-10 '), 'SAVE-10');
  assert.equal(isValidDiscountCodeFormat('SAVE10'), true);
  assert.equal(isValidDiscountCodeFormat('A'), false);
  assert.equal(isValidDiscountCodeFormat('bad code'), false);
});

test('percentage discount', () => {
  assert.deepEqual(computeDiscountedCharge(1000, { type: 'percentage', amount: 10 }), {
    discountCents: 100,
    chargeCents: 900,
  });
});

test('fixed discount', () => {
  assert.deepEqual(computeDiscountedCharge(1000, { type: 'fixed', amount: 250 }), {
    discountCents: 250,
    chargeCents: 750,
  });
});

test('full discount leaves 1 cent', () => {
  assert.deepEqual(computeDiscountedCharge(500, { type: 'percentage', amount: 100 }), {
    discountCents: 499,
    chargeCents: 1,
  });
});

test('applyDiscountToPricing keeps renewal cents', () => {
  const { pricing, discountMeta } = applyDiscountToPricing(
    { chargeCents: 999, renewalCents: 499, title: 'Plus' },
    { code: 'SAVE10', type: 'percentage', amount: 10 }
  );
  assert.equal(pricing.chargeCents, 900);
  assert.equal(pricing.renewalCents, 499);
  assert.equal(discountMeta.code, 'SAVE10');
  assert.equal(discountMeta.discountCents, 99);
});

test('TRACKER25 fixed off brings tracker hardware to €25', () => {
  const TRACKER_CENTS = 3999;
  const OFF_CENTS = 1499;
  const applied = computeDiscountedCharge(TRACKER_CENTS, { type: 'fixed', amount: OFF_CENTS });
  assert.deepEqual(applied, { discountCents: 1499, chargeCents: 2500 });
});

test('SKU-scoped discount only applies to listed SKUs', () => {
  assert.equal(
    discountAppliesToSku({ appliesToSkus: ['TRACKER_HARDWARE'] }, 'TRACKER_HARDWARE'),
    true
  );
  assert.equal(discountAppliesToSku({ appliesToSkus: ['TRACKER_HARDWARE'] }, 'PETPAL_PLUS_YEARLY'), false);
  assert.equal(discountAppliesToSku({ appliesToSkus: null }, 'PETPAL_PLUS_YEARLY'), true);

  const { pricing, discountMeta } = applyDiscountToPricing(
    { chargeCents: 3999, title: 'Tracker' },
    { code: 'TRACKER25', type: 'fixed', amount: 1499, appliesToSkus: ['TRACKER_HARDWARE'] },
    { sku: 'PETPAL_PLUS_MONTHLY' }
  );
  assert.equal(pricing.chargeCents, 3999);
  assert.equal(discountMeta, null);

  const ok = applyDiscountToPricing(
    { chargeCents: 3999, title: 'Tracker' },
    { code: 'TRACKER25', type: 'fixed', amount: 1499, appliesToSkus: ['TRACKER_HARDWARE'] },
    { sku: 'TRACKER_HARDWARE' }
  );
  assert.equal(ok.pricing.chargeCents, 2500);
  assert.equal(ok.discountMeta.discountCents, 1499);
});
