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
