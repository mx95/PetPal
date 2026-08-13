const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isCloudGpsposConfig,
  promoteCloudDeviceToDirectTcp,
  shouldSkipGpsposPoll,
} = require("../src/directTcpPromote");

function fakeStore(initial) {
  let row = initial ? { ...initial } : null;
  return {
    getDeviceConfig() {
      return row;
    },
    updateDeviceConfig(_imei, patch) {
      row = { ...(row || {}), ...patch };
    },
    _row() {
      return row;
    },
  };
}

test("promoteCloudDeviceToDirectTcp — gpspos override + poll → gt06, poll off", () => {
  const store = fakeStore({
    provider_override: "gpspos",
    gpspos_poll_enabled: 1,
  });
  const result = promoteCloudDeviceToDirectTcp(store, "868022030670793", "gt06");
  assert.equal(result.switched, true);
  assert.equal(result.from, "gpspos");
  assert.equal(result.to, "gt06");
  assert.ok(result.at);
  const row = store._row();
  assert.equal(row.provider_override, "gt06");
  assert.equal(row.gpspos_poll_enabled, 0);
  assert.equal(row.direct_tcp_from_provider, "gpspos");
  assert.equal(row.direct_tcp_switched_at, result.at);
});

test("promoteCloudDeviceToDirectTcp — already switched is a no-op", () => {
  const store = fakeStore({
    provider_override: "gt06",
    gpspos_poll_enabled: 0,
    direct_tcp_switched_at: "2026-08-13T09:14:42.000Z",
    direct_tcp_from_provider: "gpspos",
  });
  const result = promoteCloudDeviceToDirectTcp(store, "868022030670793", "gt06");
  assert.equal(result, null);
  assert.equal(store._row().direct_tcp_switched_at, "2026-08-13T09:14:42.000Z");
});

test("promoteCloudDeviceToDirectTcp — native g365 device is not switched", () => {
  const store = fakeStore({
    provider_override: "g365",
    gpspos_poll_enabled: 0,
  });
  assert.equal(promoteCloudDeviceToDirectTcp(store, "861261021001678", "gt06"), null);
});

test("isCloudGpsposConfig / shouldSkipGpsposPoll", () => {
  assert.equal(isCloudGpsposConfig({ provider_override: "gpspos", gpspos_poll_enabled: 0 }), true);
  assert.equal(isCloudGpsposConfig({ provider_override: null, gpspos_poll_enabled: 1 }), true);
  assert.equal(isCloudGpsposConfig({ provider_override: "g365", gpspos_poll_enabled: 0 }), false);
  assert.equal(shouldSkipGpsposPoll({ direct_tcp_switched_at: "2026-08-13T09:14:42.000Z" }), true);
  assert.equal(shouldSkipGpsposPoll({ provider_override: "gt06" }), true);
  assert.equal(shouldSkipGpsposPoll({ provider_override: "gpspos", gpspos_poll_enabled: 1 }), false);
});
