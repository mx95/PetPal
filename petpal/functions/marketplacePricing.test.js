import { test } from 'node:test';
import assert from 'node:assert/strict';

// Lightweight copy of pricing math for Node tests (mirrors src/shop/marketplacePricing.js).
function roundToNearestFiveCents(cents) {
  const n = Math.max(0, Math.round(Number(cents) || 0));
  return Math.round(n / 5) * 5;
}

function listedFromMerchant(merchantCents, rate) {
  const r = Number(rate);
  const m = Math.max(0, Math.round(Number(merchantCents) || 0));
  if (!(r > 0) || r >= 1) return roundToNearestFiveCents(m);
  return roundToNearestFiveCents(m / (1 - r));
}

function merchantFromListed(listedCents, rate) {
  const r = Number(rate);
  const listed = Math.max(0, Math.round(Number(listedCents) || 0));
  if (!(r > 0) || r >= 1) return roundToNearestFiveCents(listed);
  return roundToNearestFiveCents(listed * (1 - r));
}

test('€50 merchant at 12% lists near €56.80', () => {
  assert.equal(listedFromMerchant(5000, 0.12), 5680);
});

test('€50 merchant at 10% self-ship lists near €55.55 → €55.55', () => {
  // 5000 / 0.9 = 5555.55… → nearest 5 cents = 5555
  assert.equal(listedFromMerchant(5000, 0.1), 5555);
});

test('listed €56.80 at 12% returns merchant near €50', () => {
  assert.equal(merchantFromListed(5680, 0.12), 5000);
});
