const test = require("node:test");
const assert = require("node:assert/strict");
const { createMemoryStore } = require("../src/store/memory");
const { parseG365Packet } = require("../src/protocol/g365");
const { buildPositionPayload } = require("../src/http/positionPayload");

function hex(buf) {
  return Buffer.from(String(buf).replace(/\s+/g, ""), "hex");
}

test("memory store — 365GPS status battery preserved on charging event", () => {
  const store = createMemoryStore();
  const imei = "861991080050311";

  const statusFrame = hex("7878071355230803640D0A");
  const statusParsed = parseG365Packet(statusFrame, imei);
  store.upsert(imei, { ...statusParsed, imei, provider: "g365", receivedAt: new Date().toISOString() });

  let rec = store.get(imei);
  assert.equal(rec.battery, 0x55);
  assert.equal(rec.signal, 0x64);

  const chargingFrame = hex("787801820D0A");
  const chargingParsed = parseG365Packet(chargingFrame, imei);
  store.upsert(imei, { ...chargingParsed, imei, provider: "g365", receivedAt: new Date().toISOString() });

  rec = store.get(imei);
  assert.equal(rec.battery, 0x55, "battery should survive charging-only uplink");
  assert.equal(rec.charging, true);

  const payload = buildPositionPayload(imei, rec);
  assert.equal(payload.battery, 0x55);
  assert.equal(payload.isCharging, true);
  assert.equal(payload.error, undefined);
});

test("memory store — 365GPS status 0x13 clears stale charging flag", () => {
  const { createMemoryStore } = require("../src/store/memory");
  const { parseG365Packet } = require("../src/protocol/g365");
  const store = createMemoryStore();
  const imei = "861261021001678";
  const chargingParsed = parseG365Packet(Buffer.from("787801820D0A", "hex"), imei);
  store.upsert(imei, { ...chargingParsed, imei, provider: "g365", receivedAt: new Date().toISOString() });
  assert.equal(store.get(imei).charging, true);

  const statusFrame = Buffer.from("78781613500803006100000000000014F1018FEC0B0906242B0D0A", "hex");
  const statusParsed = parseG365Packet(statusFrame, imei);
  store.upsert(imei, { ...statusParsed, imei, provider: "g365", receivedAt: new Date().toISOString() });
  assert.equal(store.get(imei).charging, false);
});

test("memory store — 365GPS charging disconnect clears flag", () => {
  const store = createMemoryStore();
  const imei = "861991080050311";

  store.upsert(imei, {
    imei,
    provider: "g365",
    receivedAt: new Date().toISOString(),
    deviceStatus: { battery: 90, signal: 66, chargingStatus: 1 },
  });

  const disconnectParsed = parseG365Packet(hex("787801830D0A"), imei);
  store.upsert(imei, { ...disconnectParsed, imei, provider: "g365", receivedAt: new Date().toISOString() });

  const rec = store.get(imei);
  assert.equal(rec.battery, 90);
  assert.equal(rec.charging, false);
});

test("memory store — GPS fix clears stale atHomeWifi and returns coords with wifiBssids", () => {
  const store = createMemoryStore();
  const imei = "861261021497967";

  store.upsert(imei, {
    imei,
    provider: "g365",
    source: "wifi",
    atHomeWifi: true,
    wifiBssids: ["14:75:90:5B:D3:0E"],
    receivedAt: new Date().toISOString(),
    homeLocation: { lat: 34.71, lng: 33.07 },
  });

  store.upsert(imei, {
    imei,
    provider: "g365",
    source: "gps",
    gpsValid: true,
    location: { lat: 34.72, lng: 33.08 },
    receivedAt: new Date().toISOString(),
  });

  const rec = store.get(imei);
  assert.equal(rec.atHomeWifi, false);
  assert.equal(rec.location?.lat, 34.72);
  assert.ok(Array.isArray(rec.wifiBssids) && rec.wifiBssids.length > 0);

  const payload = buildPositionPayload(imei, rec);
  assert.equal(payload.lat, 34.72);
  assert.equal(payload.lng, 33.08);
  assert.equal(payload.source, "gps");
});

test("memory store — GPS uplink does not invent home location", () => {
  const store = createMemoryStore();
  const imei = "861261021497999";

  store.upsert(imei, {
    imei,
    provider: "g365",
    source: "gps",
    gpsValid: true,
    location: { lat: 34.71, lng: 33.07 },
    receivedAt: new Date().toISOString(),
  });

  const rec = store.get(imei);
  assert.equal(rec.homeLocation, undefined);
  assert.ok(!rec.homeExplicit);

  store.setHomeLocation(imei, 35.0, 33.5);
  const withHome = store.get(imei);
  assert.equal(withHome.homeLocation?.lat, 35.0);
  assert.equal(withHome.homeExplicit, true);
});
