const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  paidOrderStatus,
  cardVerifyOrderSucceeded,
  CARD_BINDING_FEATURES,
  CARD_BINDING_FEATURES_VERIFY_ONLY,
} = require('./jccOrderStatus');

test('treats authorized statuses as paid', () => {
  assert.equal(paidOrderStatus({ orderStatus: 1 }), true);
  assert.equal(paidOrderStatus({ orderStatus: '2' }), true);
  assert.equal(paidOrderStatus({ orderStatus: 0 }), false);
  assert.equal(paidOrderStatus({ orderStatus: 3 }), false);
});

test('accepts REVERSED (3) as successful VERIFY card registration', () => {
  assert.equal(cardVerifyOrderSucceeded({ orderStatus: 3 }), true);
  assert.equal(cardVerifyOrderSucceeded({ orderStatus: '3' }), true);
  assert.equal(cardVerifyOrderSucceeded({ orderStatus: 2 }), true);
  assert.equal(cardVerifyOrderSucceeded({ orderStatus: 6 }), false);
});

test('uses VERIFY first then FORCE_CREATE_BINDING for zero-amount binding', () => {
  assert.deepEqual(CARD_BINDING_FEATURES, ['VERIFY', 'FORCE_CREATE_BINDING']);
  assert.equal(CARD_BINDING_FEATURES_VERIFY_ONLY, 'VERIFY');
});
