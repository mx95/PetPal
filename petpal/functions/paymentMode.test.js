const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMode, maskUser, slotConfigured, restHost } = require('./paymentMode');

test('normalizeMode defaults to test', () => {
  assert.equal(normalizeMode('live'), 'live');
  assert.equal(normalizeMode('LIVE'), 'live');
  assert.equal(normalizeMode('test'), 'test');
  assert.equal(normalizeMode(''), 'test');
  assert.equal(normalizeMode(null), 'test');
});

test('maskUser hides identity', () => {
  assert.equal(maskUser('PetPal-api'), 'Pe…pi');
  assert.match(maskUser('shop@example.com'), /@example\.com$/);
});

test('slotConfigured requires user and pass', () => {
  assert.equal(slotConfigured({ user: 'a', pass: 'b' }), true);
  assert.equal(slotConfigured({ user: 'a', pass: '' }), false);
  assert.equal(slotConfigured({}), false);
});

test('restHost parses gateway host', () => {
  assert.equal(restHost('https://gateway-test.jcc.com.cy/payment/rest'), 'gateway-test.jcc.com.cy');
  assert.equal(restHost('https://gateway.jcc.com.cy/payment/rest'), 'gateway.jcc.com.cy');
});
