const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeDiscountCode,
  isValidDiscountCodeFormat,
  computeDiscountedCharge,
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
