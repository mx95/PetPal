const test = require("node:test");
const assert = require("node:assert/strict");
const {
  haversineMeters,
  pickFresherHistoryFix,
  repairStaleLastFixFromHistory,
} = require("../src/geo/repairStaleLastFix");

test("haversineMeters — Paphos vs Larnaca-ish is far", () => {
  const m = haversineMeters(34.8207, 32.3995, 34.9847, 33.8448);
  assert.ok(m > 100000, `expected >100km, got ${m}`);
});

test("pickFresherHistoryFix — prefers recent TCP trail over stale LASTPOS", () => {
  const device = {
    imei: "868022030666528",
    provider: "gt06",
    location: { lat: 34.9846733, lng: 33.8448267 },
    gps: { lat: 34.9846733, lng: 33.8448267, timestamp: "2026-08-12T14:27:02.000Z" },
    raw: { gpspos: { strTEID: "868022030666528" } },
  };
  const now = Date.now();
  const history = [
    {
      lat: 34.8207,
      lng: 32.3995,
      source: "gps",
      receivedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
      deviceTimeUtc: new Date(now - 10 * 60 * 1000).toISOString(),
    },
    {
      lat: 34.9846733,
      lng: 33.8448267,
      source: "gps",
      receivedAt: new Date(now - 5 * 60 * 1000).toISOString(),
      timestamp: new Date(now - 5 * 60 * 1000).toISOString(),
      deviceTimeUtc: "2026-08-12T14:27:02.000Z",
    },
  ];
  history.push({
    lat: 34.8208,
    lng: 32.3996,
    source: "gps",
    receivedAt: new Date(now - 2 * 60 * 1000).toISOString(),
    timestamp: new Date(now - 2 * 60 * 1000).toISOString(),
    deviceTimeUtc: new Date(now - 2 * 60 * 1000).toISOString(),
  });
  const pick = pickFresherHistoryFix(device, history);
  assert.ok(pick);
  assert.ok(Math.abs(pick.lat - 34.8208) < 0.001);
  assert.ok(Math.abs(pick.lng - 32.3996) < 0.001);
});

test("pickFresherHistoryFix — recovers when last-fix timestamp was refreshed", () => {
  const now = Date.now();
  const device = {
    imei: "868022030666528",
    provider: "gt06",
    location: { lat: 34.9846733, lng: 33.8448267 },
    // Timestamp refreshed to "now" but coords still match stale LASTPOS.
    gps: { lat: 34.9846733, lng: 33.8448267, timestamp: new Date(now - 60 * 1000).toISOString() },
  };
  const history = [
    {
      lat: 34.8207,
      lng: 32.3995,
      source: "gps",
      receivedAt: new Date(now - 20 * 60 * 1000).toISOString(),
      deviceTimeUtc: new Date(now - 20 * 60 * 1000).toISOString(),
    },
    {
      lat: 34.9846733,
      lng: 33.8448267,
      source: "gps",
      receivedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      deviceTimeUtc: "2026-08-12T14:27:02.000Z",
    },
  ];
  const pick = pickFresherHistoryFix(device, history);
  assert.ok(pick);
  assert.ok(Math.abs(pick.lat - 34.8207) < 0.001);
});

test("pickFresherHistoryFix — ignores gpspos-only / non-TCP providers", () => {
  const device = {
    imei: "1",
    provider: "gpspos",
    location: { lat: 34.98, lng: 33.84 },
    gps: { lat: 34.98, lng: 33.84, timestamp: "2026-08-12T14:27:02.000Z" },
  };
  const history = [
    {
      lat: 34.82,
      lng: 32.4,
      source: "gps",
      receivedAt: new Date().toISOString(),
      deviceTimeUtc: new Date().toISOString(),
    },
  ];
  assert.equal(pickFresherHistoryFix(device, history), null);
});

test("repairStaleLastFixFromHistory — upserts without recording when store provided", () => {
  const device = {
    imei: "868022030666528",
    provider: "gt06",
    location: { lat: 34.9846733, lng: 33.8448267 },
    gps: { lat: 34.9846733, lng: 33.8448267, timestamp: "2026-08-12T14:27:02.000Z" },
    battery: 100,
  };
  const now = Date.now();
  const history = [
    {
      lat: 34.8207,
      lng: 32.3995,
      source: "gps",
      receivedAt: new Date(now - 3 * 60 * 1000).toISOString(),
      deviceTimeUtc: new Date(now - 3 * 60 * 1000).toISOString(),
    },
  ];
  let upserted = null;
  const store = {
    history() {
      return history;
    },
    upsert(imei, data) {
      upserted = { imei, data };
    },
    get() {
      return {
        ...device,
        location: upserted.data.location,
        gps: upserted.data.gps,
        receivedAt: upserted.data.receivedAt,
      };
    },
  };
  const result = repairStaleLastFixFromHistory(store, device);
  assert.equal(result.repaired, true);
  assert.equal(upserted.data._recordPosition, false);
  assert.ok(Math.abs(result.device.location.lat - 34.8207) < 0.001);
});
