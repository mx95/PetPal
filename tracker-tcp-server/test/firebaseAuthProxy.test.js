/**
 * @jest-environment node
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { registerFirebaseAuthProxy } = require('../src/http/firebaseAuthProxy');

test('registerFirebaseAuthProxy mounts /__/auth handler', () => {
  const mounts = [];
  const app = {
    use(path, handler) {
      mounts.push({ path, handler });
    },
  };
  registerFirebaseAuthProxy(app, { authHost: 'petpal-aecda.firebaseapp.com' });
  assert.equal(mounts.length, 1);
  assert.equal(mounts[0].path, '/__/auth');
  assert.equal(typeof mounts[0].handler, 'function');
});
